import path from "path";
import fs from "fs";

const railwayDataDir = "/data";

const DB_PATH =
  process.env.NODE_ENV === "production" &&
  fs.existsSync(railwayDataDir)
    ? path.join(railwayDataDir, "memory.json")
    : path.join(process.cwd(), "memory.json");

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface SessionSummary {
  session: string;
  turns: number;
  last: string; // ISO datetime string
}

interface TurnRecord {
  id: number;
  session: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

function loadData(): TurnRecord[] {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw) as TurnRecord[];
  } catch (err) {
    console.error("Error reading JSON database:", err);
    return [];
  }
}

function saveData(data: TurnRecord[]) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing JSON database:", err);
  }
}

export function saveTurn(
  session: string,
  role: "user" | "assistant",
  content: string
) {
  const data = loadData();
  const nextId = data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1;
  const newRecord: TurnRecord = {
    id: nextId,
    session,
    role,
    content,
    created_at: new Date().toISOString()
  };
  data.push(newRecord);
  saveData(data);
}

export function getHistory(session: string, limit = 10): Turn[] {
  const data = loadData();
  const filtered = data
    .filter(d => d.session === session)
    .sort((a, b) => a.id - b.id);
  
  const sliced = filtered.slice(-limit);
  return sliced.map(d => ({
    role: d.role,
    content: d.content
  }));
}

export function getSessions(): SessionSummary[] {
  const data = loadData();
  const sessionsMap: Record<string, { turns: number; last: string }> = {};

  for (const record of data) {
    if (!sessionsMap[record.session]) {
      sessionsMap[record.session] = {
        turns: 0,
        last: record.created_at
      };
    }
    sessionsMap[record.session].turns += 1;
    if (new Date(record.created_at) > new Date(sessionsMap[record.session].last)) {
      sessionsMap[record.session].last = record.created_at;
    }
  }

  const summaries = Object.entries(sessionsMap).map(([session, info]) => ({
    session,
    turns: info.turns,
    last: info.last
  }));

  return summaries.sort((a, b) => new Date(b.last).getTime() - new Date(a.last).getTime());
}