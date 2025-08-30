// 自動バックアップスケジューラー
// 定期的にデータをエクスポートして安全性確保

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

class BackupScheduler {
  constructor(supabase) {
    this.supabase = supabase;
    this.backupDir = path.join(process.cwd(), 'backups');
    this.maxBackups = 7; // 最大7日分保持
    this.stats = {
      totalBackups: 0,
      lastBackup: null,
      totalSize: 0
    };
  }

  // バックアップ実行
  async performBackup() {
    console.log('🔄 Starting automatic backup...');
    
    try {
      // バックアップディレクトリ作成
      await fs.mkdir(this.backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupData = {
        timestamp,
        version: '1.0',
        data: {}
      };

      // 1. 予約データ
      const { data: reservations } = await this.supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false });
      
      backupData.data.reservations = reservations || [];
      
      // 2. 時間制限設定
      const { data: restrictions } = await this.supabase
        .from('time_restrictions')
        .select('*');
      
      backupData.data.restrictions = restrictions || [];
      
      // 3. 定期制限設定
      const { data: recurring } = await this.supabase
        .from('recurring_restrictions')
        .select('*');
      
      backupData.data.recurring = recurring || [];

      // 4. 統計情報を追加
      backupData.stats = {
        reservationCount: backupData.data.reservations.length,
        restrictionCount: backupData.data.restrictions.length,
        recurringCount: backupData.data.recurring.length,
        backupSize: JSON.stringify(backupData).length
      };

      // ファイル保存
      const filename = `backup-${timestamp}.json`;
      const filepath = path.join(this.backupDir, filename);
      
      await fs.writeFile(
        filepath,
        JSON.stringify(backupData, null, 2),
        'utf8'
      );

      // 統計更新
      this.stats.totalBackups++;
      this.stats.lastBackup = timestamp;
      this.stats.totalSize = backupData.stats.backupSize;

      console.log(`✅ Backup completed: ${filename}`);
      console.log(`   - Reservations: ${backupData.stats.reservationCount}`);
      console.log(`   - Size: ${(backupData.stats.backupSize / 1024).toFixed(2)} KB`);

      // 古いバックアップを削除
      await this.cleanOldBackups();

      return {
        success: true,
        filename,
        stats: backupData.stats
      };

    } catch (error) {
      console.error('❌ Backup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 古いバックアップ削除
  async cleanOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('backup-'))
        .sort()
        .reverse();

      // 最新7つを残して削除
      const filesToDelete = backupFiles.slice(this.maxBackups);
      
      for (const file of filesToDelete) {
        const filepath = path.join(this.backupDir, file);
        await fs.unlink(filepath);
        console.log(`🗑️ Deleted old backup: ${file}`);
      }

      return filesToDelete.length;
    } catch (error) {
      console.error('Error cleaning old backups:', error);
      return 0;
    }
  }

  // バックアップリストア
  async restore(filename) {
    try {
      const filepath = path.join(this.backupDir, filename);
      const content = await fs.readFile(filepath, 'utf8');
      const backupData = JSON.parse(content);

      console.log(`📥 Restoring from ${filename}...`);

      // 復元処理（実装は慎重に）
      // ここでは構造のみ示す
      const result = {
        restored: {
          reservations: 0,
          restrictions: 0,
          recurring: 0
        },
        errors: []
      };

      // 実際の復元は管理者確認後に実行
      console.log('⚠️ Restore prepared. Execute manually with confirmation.');
      
      return {
        success: true,
        data: backupData,
        result
      };

    } catch (error) {
      console.error('Restore failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 利用可能なバックアップ一覧
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('backup-'))
        .sort()
        .reverse();

      const backups = [];
      for (const file of backupFiles) {
        const filepath = path.join(this.backupDir, file);
        const stats = await fs.stat(filepath);
        
        backups.push({
          filename: file,
          size: stats.size,
          created: stats.mtime,
          sizeKB: (stats.size / 1024).toFixed(2)
        });
      }

      return backups;
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  // 統計取得
  getStats() {
    return {
      ...this.stats,
      backupDirectory: this.backupDir,
      maxBackups: this.maxBackups,
      sizeMB: (this.stats.totalSize / 1024 / 1024).toFixed(2)
    };
  }
}

export default BackupScheduler;