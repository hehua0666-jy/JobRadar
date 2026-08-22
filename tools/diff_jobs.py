#!/usr/bin/env python3
from pathlib import Path
import json, datetime, shutil

ROOT = Path(__file__).resolve().parents[1]
CUR = ROOT / "jobs.json"
PREV = ROOT / "data" / "jobs_previous.json"
CHANGES = ROOT / "changes.json"

def load(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []

def normalized(job):
    ignore={"last_verified","recent"}
    return {k:v for k,v in job.items() if k not in ignore}

current=load(CUR)
previous=load(PREV)
cur={j["id"]:j for j in current}
prev={j["id"]:j for j in previous}
today=datetime.date.today().isoformat()
changes=[]

for jid,j in cur.items():
    if jid not in prev:
        changes.append({"type":"new","date":today,"id":jid,"company":j.get("company",""),"role":j.get("role",""),"city":j.get("city",""),"url":j.get("url","")})
    elif normalized(j)!=normalized(prev[jid]):
        changes.append({"type":"updated","date":today,"id":jid,"company":j.get("company",""),"role":j.get("role",""),"city":j.get("city",""),"url":j.get("url","")})

for jid,j in prev.items():
    if jid not in cur:
        changes.append({"type":"closed","date":today,"id":jid,"company":j.get("company",""),"role":j.get("role",""),"city":j.get("city",""),"url":j.get("url","")})

CHANGES.write_text(json.dumps(changes,ensure_ascii=False,indent=2),encoding="utf-8")
PREV.parent.mkdir(exist_ok=True)
shutil.copy2(CUR,PREV)
print(f"Generated {len(changes)} change records.")
