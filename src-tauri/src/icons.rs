//! Native Windows shell icons (the same icons Explorer shows for each file type).

#[cfg(windows)]
mod win {
    use std::ffi::c_void;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC,
        BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
    };
    use windows::Win32::Storage::FileSystem::{
        FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_NORMAL, FILE_FLAGS_AND_ATTRIBUTES,
    };
    use windows::Win32::UI::Controls::{IImageList, ILD_TRANSPARENT};
    use windows::Win32::UI::Shell::{
        SHGetFileInfoW, SHGetImageList, SHFILEINFOW, SHGFI_SYSICONINDEX, SHGFI_USEFILEATTRIBUTES,
        SHIL_EXTRALARGE, SHIL_JUMBO, SHIL_LARGE,
    };
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO};

    pub(crate) fn to_wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// Reads one bitmap as top-down 32bpp BGRA.
    unsafe fn read_bitmap(
        hdc: windows::Win32::Graphics::Gdi::HDC,
        bmp: windows::Win32::Graphics::Gdi::HBITMAP,
    ) -> Option<(u32, u32, Vec<u8>)> {
        let mut bm = BITMAP::default();
        if GetObjectW(
            HGDIOBJ(bmp.0),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bm as *mut _ as *mut c_void),
        ) == 0
        {
            return None;
        }
        let w = bm.bmWidth.unsigned_abs();
        let h = bm.bmHeight.unsigned_abs();
        if w == 0 || h == 0 {
            return None;
        }
        let mut bmi = BITMAPINFO::default();
        bmi.bmiHeader = BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: w as i32,
            biHeight: -(h as i32),
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        };
        let mut buf = vec![0u8; (w * h * 4) as usize];
        let lines = GetDIBits(
            hdc,
            bmp,
            0,
            h,
            Some(buf.as_mut_ptr() as *mut c_void),
            &mut bmi,
            DIB_RGB_COLORS,
        );
        if lines == 0 {
            // Some display drivers fail with negative biHeight; fallback to bottom-up and flip
            bmi.bmiHeader.biHeight = h as i32;
            let lines2 = GetDIBits(
                hdc,
                bmp,
                0,
                h,
                Some(buf.as_mut_ptr() as *mut c_void),
                &mut bmi,
                DIB_RGB_COLORS,
            );
            if lines2 == 0 {
                return None;
            }
            let row_bytes = (w * 4) as usize;
            let mut temp = vec![0u8; row_bytes];
            for y in 0..(h as usize / 2) {
                let top = y * row_bytes;
                let bottom = ((h as usize) - 1 - y) * row_bytes;
                temp.copy_from_slice(&buf[top..top + row_bytes]);
                buf.copy_within(bottom..bottom + row_bytes, top);
                buf[bottom..bottom + row_bytes].copy_from_slice(&temp);
            }
        }
        Some((w, h, buf))
    }

    unsafe fn hicon_to_png(icon: HICON) -> Option<Vec<u8>> {
        let mut info = ICONINFO::default();
        GetIconInfo(icon, &mut info).ok()?;
        let screen = GetDC(Some(HWND::default()));
        let hdc = CreateCompatibleDC(Some(screen));

        let result = (|| {
            let (w, h, mut px) = read_bitmap(hdc, info.hbmColor)?;
            // Is there a real alpha channel?
            let has_alpha = px.chunks_exact(4).any(|p| p[3] != 0);
            if !has_alpha {
                let mask = read_bitmap(hdc, info.hbmMask);
                for (i, p) in px.chunks_exact_mut(4).enumerate() {
                    let opaque = match &mask {
                        Some((_, _, m)) => m[i * 4] == 0,
                        None => true,
                    };
                    p[3] = if opaque { 255 } else { 0 };
                }
            }
            // BGRA -> RGBA
            for p in px.chunks_exact_mut(4) {
                p.swap(0, 2);
            }
            let mut out = Vec::new();
            {
                let mut enc = png::Encoder::new(&mut out, w, h);
                enc.set_color(png::ColorType::Rgba);
                enc.set_depth(png::BitDepth::Eight);
                let mut writer = enc.write_header().ok()?;
                writer.write_image_data(&px).ok()?;
            }
            Some(out)
        })();

        let _ = DeleteDC(hdc);
        ReleaseDC(Some(HWND::default()), screen);
        if !info.hbmColor.is_invalid() {
            let _ = DeleteObject(HGDIOBJ(info.hbmColor.0));
        }
        if !info.hbmMask.is_invalid() {
            let _ = DeleteObject(HGDIOBJ(info.hbmMask.0));
        }
        result
    }

    /// `ext` without dot ("docx"); empty string + `is_dir` for folders.
    pub fn icon_png(ext: &str, is_dir: bool) -> Option<Vec<u8>> {
        unsafe {
            let clean_ext = ext.trim_start_matches('.').to_lowercase();
            let name = if is_dir {
                "folder".to_string()
            } else if clean_ext.is_empty() {
                "file".to_string()
            } else {
                format!("file.{}", clean_ext)
            };
            let wide = to_wide(&name);
            let attrs: FILE_FLAGS_AND_ATTRIBUTES = if is_dir {
                FILE_ATTRIBUTE_DIRECTORY
            } else {
                FILE_ATTRIBUTE_NORMAL
            };
            let mut sfi = SHFILEINFOW::default();
            let r = SHGetFileInfoW(
                PCWSTR(wide.as_ptr()),
                attrs,
                Some(&mut sfi),
                std::mem::size_of::<SHFILEINFOW>() as u32,
                SHGFI_SYSICONINDEX | SHGFI_USEFILEATTRIBUTES,
            );
            if r == 0 {
                return None;
            }
            for size in [SHIL_JUMBO as i32, SHIL_EXTRALARGE as i32, SHIL_LARGE as i32] {
                if let Ok(list) = SHGetImageList::<IImageList>(size) {
                    if let Ok(icon) = list.GetIcon(sfi.iIcon, ILD_TRANSPARENT.0 as u32) {
                        let png = hicon_to_png(icon);
                        let _ = DestroyIcon(icon);
                        if png.is_some() {
                            return png;
                        }
                    }
                }
            }
            None
        }
    }

    unsafe fn shell_thumbnail_worker(path: &str, size: u32) -> Option<Vec<u8>> {
        use windows::Win32::UI::Shell::{
            IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_BIGGERSIZEOK, SIIGBF_THUMBNAILONLY,
        };
        use windows::Win32::Foundation::SIZE;
        use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};

        let co_init = CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok();
        let wide = to_wide(path);
        let item: IShellItemImageFactory = match SHCreateItemFromParsingName(PCWSTR(wide.as_ptr()), None) {
            Ok(it) => it,
            Err(_) => {
                if co_init {
                    CoUninitialize();
                }
                return None;
            }
        };

        let sz = SIZE { cx: size as i32, cy: size as i32 };
        // SIIGBF_THUMBNAILONLY ensures Windows only returns actual thumbnails from thumbnail providers.
        // It prevents Windows from returning the generic file icon when no thumbnail provider exists.
        let bmp = item.GetImage(sz, SIIGBF_THUMBNAILONLY | SIIGBF_BIGGERSIZEOK)
            .or_else(|_| item.GetImage(sz, SIIGBF_THUMBNAILONLY));

        let Ok(bmp) = bmp else {
            if co_init {
                CoUninitialize();
            }
            return None;
        };
        if bmp.is_invalid() {
            if co_init {
                CoUninitialize();
            }
            return None;
        }

        let screen = GetDC(Some(HWND::default()));
        let hdc = CreateCompatibleDC(Some(screen));
        let result = (|| {
            let (w, h, mut px) = read_bitmap(hdc, bmp)?;
            let has_alpha = px.chunks_exact(4).any(|p| p[3] != 0);
            // BGRA -> RGBA
            for p in px.chunks_exact_mut(4) {
                p.swap(0, 2);
                if !has_alpha {
                    p[3] = 255;
                }
            }
            let mut out = Vec::new();
            {
                let mut enc = png::Encoder::new(&mut out, w, h);
                enc.set_color(png::ColorType::Rgba);
                enc.set_depth(png::BitDepth::Eight);
                let mut writer = enc.write_header().ok()?;
                writer.write_image_data(&px).ok()?;
            }
            Some(out)
        })();

        let _ = DeleteDC(hdc);
        ReleaseDC(Some(HWND::default()), screen);
        let _ = DeleteObject(HGDIOBJ(bmp.0));
        if co_init {
            CoUninitialize();
        }
        result
    }

    pub fn shell_thumbnail_png(path: &str, size: u32) -> Option<Vec<u8>> {
        let normalized = path.replace('/', "\\");
        unsafe { shell_thumbnail_worker(&normalized, size) }
    }
}

#[cfg(windows)]
pub(crate) use win::to_wide;

#[cfg(windows)]
pub fn get_icon_png(ext: &str, is_dir: bool) -> Option<Vec<u8>> {
    win::icon_png(ext, is_dir)
}

#[cfg(windows)]
pub fn get_shell_thumbnail_png(path: &str, size: u32) -> Option<Vec<u8>> {
    win::shell_thumbnail_png(path, size)
}

#[cfg(not(windows))]
pub fn get_icon_png(_ext: &str, _is_dir: bool) -> Option<Vec<u8>> {
    None
}

#[cfg(not(windows))]
pub fn get_shell_thumbnail_png(_path: &str, _size: u32) -> Option<Vec<u8>> {
    None
}

