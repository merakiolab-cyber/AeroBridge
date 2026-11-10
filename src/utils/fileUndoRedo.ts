/**
 * AeroBridge Studio — File Operation Undo / Redo Manager
 *
 * Tracks local file system operations (rename, move, copy, new-folder, delete)
 * and allows reverting (Ctrl+Z) or reapplying (Ctrl+Y / Ctrl+Shift+Z) them.
 */

import {
  renameFileNative,
  moveFilesNative,
  copyFilesNative,
  deleteFilesNative,
  createFolderNative,
  isDesktopApp,
} from './tauriBridge';

export interface RenameOp {
  type: 'rename';
  oldPath: string;
  newPath: string;
  timestamp: number;
}

export interface MoveOp {
  type: 'move';
  items: Array<{ source: string; destination: string }>;
  timestamp: number;
}

export interface CopyOp {
  type: 'copy';
  sources: string[];
  destFolder: string;
  createdPaths: string[];
  timestamp: number;
}

export interface CreateFolderOp {
  type: 'create-folder';
  createdPath: string;
  parentPath: string;
  folderName: string;
  timestamp: number;
}

export interface DeleteOp {
  type: 'delete';
  paths: string[];
  timestamp: number;
}

export type FileOperation = RenameOp | MoveOp | CopyOp | CreateFolderOp | DeleteOp;

class FileUndoRedoManager {
  private undoStack: FileOperation[] = [];
  private redoStack: FileOperation[] = [];
  private maxHistory = 50;
  private isExecuting = false;

  public recordRename(oldPath: string, newPath: string): void {
    if (this.isExecuting || !oldPath || !newPath || oldPath === newPath) return;
    this.pushUndo({
      type: 'rename',
      oldPath,
      newPath,
      timestamp: Date.now(),
    });
  }

  public recordMove(items: Array<{ source: string; destination: string }>): void {
    if (this.isExecuting || !items || items.length === 0) return;
    this.pushUndo({
      type: 'move',
      items: [...items],
      timestamp: Date.now(),
    });
  }

  public recordCopy(sources: string[], destFolder: string, createdPaths: string[]): void {
    if (this.isExecuting || !createdPaths || createdPaths.length === 0) return;
    this.pushUndo({
      type: 'copy',
      sources: [...sources],
      destFolder,
      createdPaths: [...createdPaths],
      timestamp: Date.now(),
    });
  }

  public recordCreateFolder(createdPath: string, parentPath: string, folderName: string): void {
    if (this.isExecuting || !createdPath) return;
    this.pushUndo({
      type: 'create-folder',
      createdPath,
      parentPath,
      folderName,
      timestamp: Date.now(),
    });
  }

  public recordDelete(paths: string[]): void {
    if (this.isExecuting || !paths || paths.length === 0) return;
    this.pushUndo({
      type: 'delete',
      paths: [...paths],
      timestamp: Date.now(),
    });
  }

  private pushUndo(op: FileOperation): void {
    this.undoStack.push(op);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // Any new user action invalidates the redo branch
    this.redoStack = [];
    this.notifyStateChange();
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoDescription(): string | null {
    const top = this.undoStack[this.undoStack.length - 1];
    if (!top) return null;
    return this.describeOp(top);
  }

  public getRedoDescription(): string | null {
    const top = this.redoStack[this.redoStack.length - 1];
    if (!top) return null;
    return this.describeOp(top);
  }

  private describeOp(op: FileOperation): string {
    switch (op.type) {
      case 'rename': {
        const oldName = op.oldPath.split(/[/\\]/).pop() || op.oldPath;
        const newName = op.newPath.split(/[/\\]/).pop() || op.newPath;
        return `Přejmenování "${newName}" ➔ "${oldName}"`;
      }
      case 'move':
        return `Přesun ${op.items.length} ${op.items.length === 1 ? 'položky' : 'položek'}`;
      case 'copy':
        return `Kopírování ${op.createdPaths.length} ${op.createdPaths.length === 1 ? 'položky' : 'položek'}`;
      case 'create-folder':
        return `Vytvoření složky "${op.folderName}"`;
      case 'delete':
        return `Smazání ${op.paths.length} ${op.paths.length === 1 ? 'položky' : 'položek'}`;
    }
  }

  /**
   * Reverts the most recent file operation.
   */
  public async undo(): Promise<{ success: boolean; message: string }> {
    if (!isDesktopApp()) {
      return { success: false, message: 'Undo/Redo souborových operací vyžaduje desktopovou aplikaci' };
    }
    if (this.isExecuting || this.undoStack.length === 0) {
      return { success: false, message: 'Žádná operace k vrácení zpět' };
    }

    const op = this.undoStack.pop()!;
    this.isExecuting = true;

    try {
      switch (op.type) {
        case 'rename': {
          // Rename newPath back to oldName
          const oldName = op.oldPath.split(/[/\\]/).pop() || '';
          if (!oldName) throw new Error('Neplatný původní název');
          const restoredPath = await renameFileNative(op.newPath, oldName);
          this.redoStack.push({
            type: 'rename',
            oldPath: restoredPath,
            newPath: op.newPath,
            timestamp: Date.now(),
          });
          this.broadcastRefresh();
          return { success: true, message: `Přejmenováno zpět na "${oldName}"` };
        }

        case 'move': {
          // Move each item from destination back to original source folder
          const movedBackItems: Array<{ source: string; destination: string }> = [];
          for (const item of op.items) {
            const originalDir = item.source.substring(0, item.source.lastIndexOf('\\')) ||
                                item.source.substring(0, item.source.lastIndexOf('/'));
            if (originalDir) {
              const res = await moveFilesNative([item.destination], originalDir);
              if (res && res.length > 0) {
                movedBackItems.push({ source: item.destination, destination: res[0] });
              }
            }
          }
          this.redoStack.push({
            type: 'move',
            items: movedBackItems,
            timestamp: Date.now(),
          });
          this.broadcastRefresh();
          return {
            success: true,
            message: `Přesunuto zpět ${op.items.length} ${op.items.length === 1 ? 'položka' : 'položek'}`,
          };
        }

        case 'copy': {
          // Delete created copies (send to Recycle Bin)
          await deleteFilesNative(op.createdPaths);
          this.redoStack.push({
            type: 'copy',
            sources: op.sources,
            destFolder: op.destFolder,
            createdPaths: op.createdPaths,
            timestamp: Date.now(),
          });
          this.broadcastRefresh();
          return {
            success: true,
            message: `Odstraněno ${op.createdPaths.length} zkopírovaných souborů (vloženo do Koše)`,
          };
        }

        case 'create-folder': {
          // Delete created folder (send to Recycle Bin)
          await deleteFilesNative([op.createdPath]);
          this.redoStack.push({
            type: 'create-folder',
            createdPath: op.createdPath,
            parentPath: op.parentPath,
            folderName: op.folderName,
            timestamp: Date.now(),
          });
          this.broadcastRefresh();
          return { success: true, message: `Složka "${op.folderName}" smazána do Koše` };
        }

        case 'delete': {
          // Windows delete moved files to Recycle Bin
          this.redoStack.push(op);
          return {
            success: true,
            message: 'Smazané soubory jsou uloženy v Koši Windows (obnovte je z Koše)',
          };
        }
      }
    } catch (err) {
      // Put op back on stack if it failed
      this.undoStack.push(op);
      return { success: false, message: `Chyba při vrácení zpět: ${String(err)}` };
    } finally {
      this.isExecuting = false;
      this.notifyStateChange();
    }
  }

  /**
   * Reapplies the most recently undone file operation.
   */
  public async redo(): Promise<{ success: boolean; message: string }> {
    if (!isDesktopApp()) {
      return { success: false, message: 'Undo/Redo souborových operací vyžaduje desktopovou aplikaci' };
    }
    if (this.isExecuting || this.redoStack.length === 0) {
      return { success: false, message: 'Žádná operace k opakování' };
    }

    const op = this.redoStack.pop()!;
    this.isExecuting = true;

    try {
      switch (op.type) {
        case 'rename': {
          const newName = op.newPath.split(/[/\\]/).pop() || '';
          if (!newName) throw new Error('Neplatný nový název');
          const redonePath = await renameFileNative(op.oldPath, newName);
          this.undoStack.push({
            type: 'rename',
            oldPath: op.oldPath,
            newPath: redonePath,
            timestamp: Date.now(),
          });
          this.broadcastRefresh();
          return { success: true, message: `Znovu přejmenováno na "${newName}"` };
        }

        case 'move': {
          const redoneItems: Array<{ source: string; destination: string }> = [];
          for (const item of op.items) {
            const destDir = item.source.substring(0, item.source.lastIndexOf('\\')) ||
                            item.source.substring(0, item.source.lastIndexOf('/'));
            if (destDir) {
              const res = await moveFilesNative([item.destination], destDir);
              if (res && res.length > 0) {
                redoneItems.push({ source: item.destination, destination: res[0] });
              }
            }
          }
          this.undoStack.push({
            type: 'move',
            items: redoneItems,
            timestamp: Date.now(),
          });
          this.broadcastRefresh();
          return {
            success: true,
            message: `Znovu přesunuto ${op.items.length} ${op.items.length === 1 ? 'položka' : 'položek'}`,
          };
        }

        case 'copy': {
          const created = await copyFilesNative(op.sources, op.destFolder);
          this.undoStack.push({
            type: 'copy',
            sources: op.sources,
            destFolder: op.destFolder,
            createdPaths: created,
            timestamp: Date.now(),
          });
          this.broadcastRefresh();
          return {
            success: true,
            message: `Znovu zkopírováno ${created.length} položek`,
          };
        }

        case 'create-folder': {
          const created = await createFolderNative(op.parentPath, op.folderName);
          this.undoStack.push({
            type: 'create-folder',
            createdPath: created,
            parentPath: op.parentPath,
            folderName: op.folderName,
            timestamp: Date.now(),
          });
          this.broadcastRefresh();
          return { success: true, message: `Složka "${op.folderName}" znovu vytvořena` };
        }

        case 'delete': {
          this.undoStack.push(op);
          return { success: true, message: 'Operace smazání byla zaznamenána' };
        }
      }
    } catch (err) {
      this.redoStack.push(op);
      return { success: false, message: `Chyba při opakování akce: ${String(err)}` };
    } finally {
      this.isExecuting = false;
      this.notifyStateChange();
    }
  }

  private broadcastRefresh(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aerobridge:tree-refresh', { detail: { silent: true } }));
      window.dispatchEvent(new CustomEvent('aerobridge:folder-sync-tick'));
    }
  }

  private notifyStateChange(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('aerobridge:undo-redo-change', {
          detail: {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            undoDesc: this.getUndoDescription(),
            redoDesc: this.getRedoDescription(),
          },
        })
      );
    }
  }
}

export const fileUndoRedo = new FileUndoRedoManager();

