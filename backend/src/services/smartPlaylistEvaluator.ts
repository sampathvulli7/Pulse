import { db } from '../db/database';

export interface SmartRule {
  id?: string;
  field: string;
  operator: string;
  value: string;
  logic_gate?: 'AND' | 'OR';
}

const FIELD_MAP: Record<string, string> = {
  genre: 'genre',
  artist: 'artist',
  bpm: 'bpm',
  energy: 'energy',
  play_count: 'play_count',
  skip_count: 'skip_count',
  duration: 'duration_seconds',
};

export function evaluateSmartPlaylistRules(playlistId: string) {
  const rules = db.prepare('SELECT * FROM smart_playlist_rules WHERE playlist_id = ?').all(playlistId) as SmartRule[];

  if (!rules || rules.length === 0) {
    return db.prepare('SELECT * FROM tracks ORDER BY created_at DESC LIMIT 50').all();
  }

  return evaluateRules(rules);
}

export function evaluateRules(rules: SmartRule[]) {
  if (rules.length === 0) {
    return [];
  }

  const clauses: string[] = [];
  const params: any[] = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const column = FIELD_MAP[rule.field] || 'genre';
    const isText = rule.field === 'genre' || rule.field === 'artist';

    let condition = '';
    switch (rule.operator) {
      case 'equals':
        if (isText) {
          condition = `LOWER(${column}) = LOWER(?)`;
          params.push(rule.value);
        } else {
          condition = `${column} = ?`;
          params.push(Number(rule.value));
        }
        break;
      case 'contains':
        condition = `LOWER(${column}) LIKE LOWER(?)`;
        params.push(`%${rule.value}%`);
        break;
      case 'greater_than':
        condition = `${column} >= ?`;
        params.push(Number(rule.value));
        break;
      case 'less_than':
        condition = `${column} <= ?`;
        params.push(Number(rule.value));
        break;
      case 'between': {
        const [low, high] = rule.value.split(',').map((v) => Number(v.trim()));
        condition = `${column} BETWEEN ? AND ?`;
        params.push(low, high);
        break;
      }
      default:
        condition = `LOWER(${column}) LIKE LOWER(?)`;
        params.push(`%${rule.value}%`);
    }

    if (i === 0) {
      clauses.push(`(${condition})`);
    } else {
      const gate = rule.logic_gate === 'OR' ? 'OR' : 'AND';
      clauses.push(`${gate} (${condition})`);
    }
  }

  const sql = `SELECT * FROM tracks WHERE ${clauses.join(' ')} ORDER BY title ASC`;
  return db.prepare(sql).all(...params);
}
