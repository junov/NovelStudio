#!/usr/bin/env python3
"""
NovelStudio Model Context Protocol (MCP) stdio server.
Exposes NovelStudio craft tools exclusively to Antigravity CLI and external agents.
@spec AGT-010, REV-004
"""

import sys
import json
import os
import re
import urllib.request
import subprocess
from pathlib import Path

# Base project directory defaults to current working directory, overridable via --project or NOVELSTUDIO_PROJECT
PROJECT_ROOT = Path.cwd().resolve()
for _i, _arg in enumerate(sys.argv):
    if _arg == "--project" and _i + 1 < len(sys.argv):
        PROJECT_ROOT = Path(sys.argv[_i + 1]).resolve()
        break
if "NOVELSTUDIO_PROJECT" in os.environ:
    PROJECT_ROOT = Path(os.environ["NOVELSTUDIO_PROJECT"]).resolve()

# Bundled toolkit directory overridable via --toolkit or NOVELSTUDIO_TOOLKIT
TOOLKIT_ROOT = None
for _i, _arg in enumerate(sys.argv):
    if _arg == "--toolkit" and _i + 1 < len(sys.argv):
        TOOLKIT_ROOT = Path(sys.argv[_i + 1]).resolve()
        break
if not TOOLKIT_ROOT and "NOVELSTUDIO_TOOLKIT" in os.environ:
    TOOLKIT_ROOT = Path(os.environ["NOVELSTUDIO_TOOLKIT"]).resolve()
if not TOOLKIT_ROOT:
    dev_assist = Path("C:/Users/Justin/Documents/dev/NovelAssist")
    if (dev_assist / "third_party" / "specnovelist").is_dir():
        TOOLKIT_ROOT = (dev_assist / "third_party" / "specnovelist").resolve()

def confine_path(rel_path: str) -> Path:
    p = Path(rel_path)
    if p.is_absolute():
        raise ValueError(f"Absolute paths not permitted: {rel_path}")
    resolved = (PROJECT_ROOT / p).resolve()
    try:
        resolved.relative_to(PROJECT_ROOT)
    except ValueError:
        raise ValueError(f"Path escapes project root: {rel_path}")
    return resolved

def tool_read_file(args: dict) -> str:
    path_str = args.get("path", "")
    if not path_str:
        return "Error: path is required"
    target = confine_path(path_str)
    if not target.is_file():
        return f"Error: file not found: {path_str}"
    try:
        return target.read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading file: {e}"

def tool_write_file(args: dict) -> str:
    path_str = args.get("path", "")
    content = args.get("content", "")
    if not path_str:
        return "Error: path is required"
    target = confine_path(path_str)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"Successfully wrote {len(content)} characters to {path_str}"
    except Exception as e:
        return f"Error writing file: {e}"

def tool_delete_file(args: dict) -> str:
    path_str = args.get("path", "")
    if not path_str:
        return "Error: path is required"
    target = confine_path(path_str)
    if not target.exists():
        return f"File does not exist: {path_str}"
    try:
        if target.is_file():
            target.unlink()
            return f"Successfully deleted {path_str}"
        return f"Error: {path_str} is not a file"
    except Exception as e:
        return f"Error deleting file: {e}"

def tool_list_project_files(args: dict) -> str:
    folder = args.get("folder", "")
    base = confine_path(folder) if folder else PROJECT_ROOT
    if not base.exists():
        return f"Directory not found: {folder}"
    
    files = []
    ignored = {".git", "node_modules", ".svelte-kit", "build", "dist", "target", "__pycache__"}
    for root, dirs, filenames in os.walk(base):
        dirs[:] = [d for d in dirs if d not in ignored]
        for f in filenames:
            full = Path(root) / f
            rel = full.relative_to(PROJECT_ROOT).as_posix()
            files.append(rel)
    
    files.sort()
    return json.dumps(files[:500], indent=2)

def tool_read_toolkit_doc(args: dict) -> str:
    path_str = str(args.get("path") or args.get("doc_path") or args.get("file") or "").strip()
    if not path_str:
        return "Error: path is required"
    env_toolkit = os.environ.get("NOVELSTUDIO_TOOLKIT", "")
    bases: list[Path] = []
    if TOOLKIT_ROOT:
        bases.append(TOOLKIT_ROOT)
    if env_toolkit:
        bases.append(Path(env_toolkit))
    bases.extend([
        PROJECT_ROOT,
        PROJECT_ROOT / "third_party" / "specnovelist",
        PROJECT_ROOT / "third_party" / "specdrive",
        PROJECT_ROOT / ".agents",
        Path("C:/Users/Justin/Documents/dev/NovelAssist"),
        Path("C:/Users/Justin/Documents/dev/NovelAssist/third_party/specnovelist"),
        Path("C:/Users/Justin/Documents/dev/NovelAssist/third_party/specdrive"),
        Path("C:/Users/Justin/Documents/dev/NovelAssist/src-tauri/target/debug/specnovelist")
    ])

    variants = [
        path_str,
        f".agents/{path_str}",
        f".agents/skills/{path_str}",
        path_str.replace("skills/", ".agents/skills/")
    ]

    for b in bases:
        for v in variants:
            c = (b / v).resolve()
            if c.is_file():
                try:
                    return c.read_text(encoding="utf-8")
                except Exception as e:
                    return f"Error reading toolkit doc: {e}"
    return f"Toolkit document not found: {path_str}"

def tool_specnovel(args: dict) -> str:
    # @spec REV-004 Guardrail: block accept or git commit
    subcommand = str(args.get("subcommand") or args.get("command") or "").strip()
    raw_args = args.get("args", [])
    if isinstance(raw_args, str):
        raw_args = [raw_args]
    elif not isinstance(raw_args, list):
        raw_args = []
    else:
        raw_args = list(raw_args)

    if not subcommand and raw_args:
        subcommand = str(raw_args.pop(0)).strip()

    all_tokens = [subcommand] + [str(a) for a in raw_args]
    if "accept" in all_tokens:
        return (
            "Guardrail Error: Agents are strictly prohibited from running 'specnovel accept' "
            "or committing changes (@spec REV-004). All file changes must remain unstaged in Git "
            "so the author can review and accept them manually via the UI."
        )

    # Locate specnovel.py
    script_candidates = [
        PROJECT_ROOT / "scripts" / "specnovel.py",
        PROJECT_ROOT / "third_party" / "specnovelist" / "scripts" / "specnovel.py",
        PROJECT_ROOT / "third_party" / "specdrive" / "scripts" / "specdrive.py",
    ]
    if TOOLKIT_ROOT:
        script_candidates.insert(0, TOOLKIT_ROOT / "scripts" / "specnovel.py")
        script_candidates.insert(1, TOOLKIT_ROOT / "third_party" / "specnovelist" / "scripts" / "specnovel.py")
        script_candidates.insert(2, TOOLKIT_ROOT / "third_party" / "specdrive" / "scripts" / "specdrive.py")
    script_candidates.extend([
        Path("C:/Users/Justin/Documents/dev/NovelAssist/third_party/specnovelist/scripts/specnovel.py"),
        Path("C:/Users/Justin/Documents/dev/NovelAssist/src-tauri/target/debug/specnovelist/scripts/specnovel.py")
    ])

    script_path = None
    for cand in script_candidates:
        if cand.is_file():
            script_path = cand
            break

    if not script_path:
        return "Error: specnovel.py or specdrive.py not found in project scripts or toolkit."

    cmd = [sys.executable, str(script_path), "-C", str(PROJECT_ROOT), subcommand] + [str(a) for a in raw_args]
    try:
        res = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=60)
        out = res.stdout + (f"\n[stderr]\n{res.stderr}" if res.stderr else "")
        return out.strip() or f"(Exit code {res.returncode})"
    except Exception as e:
        return f"Error executing specnovel: {e}"

def tool_fetch_url(args: dict) -> str:
    url = args.get("url", "")
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        return "Error: Valid http or https URL is required"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "NovelStudio-Agent/0.1.0"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            # Strip script, style, and HTML tags
            cleaned = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
            cleaned = re.sub(r"<[^>]+>", " ", cleaned)
            cleaned = re.sub(r"\s+", " ", cleaned).strip()
            return cleaned[:10000]
    except Exception as e:
        return f"Error fetching URL: {e}"

def tool_ask_user(args: dict) -> str:
    # Formatted ask_user question summary
    questions = args.get("questions", [])
    title = args.get("title", "Author Interview")
    return (
        f"Author Question Registered: '{title}' with {len(questions)} question(s). "
        "NovelStudio surfaces this question directly in the author activity feed."
    )

TOOLS_REGISTRY = {
    "read_file": {
        "description": "Read the text content of a file in the novel project.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path from project root (e.g. 'initial/synopsis.md')."}
            },
            "required": ["path"]
        },
        "handler": tool_read_file
    },
    "write_file": {
        "description": "Create or update a file in the novel project. Replaces existing content.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path from project root (e.g. 'setup/brief.md')."},
                "content": {"type": "string", "description": "Full text content to write."},
                "summary": {"type": "string", "description": "Short 1-line description of the change for review."}
            },
            "required": ["path", "content"]
        },
        "handler": tool_write_file
    },
    "delete_file": {
        "description": "Delete a file from the novel project.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path to delete."}
            },
            "required": ["path"]
        },
        "handler": tool_delete_file
    },
    "list_project_files": {
        "description": "List all files in the novel project.",
        "parameters": {
            "type": "object",
            "properties": {
                "folder": {"type": "string", "description": "Optional subfolder prefix to filter by."}
            }
        },
        "handler": tool_list_project_files
    },
    "read_toolkit_doc": {
        "description": "Read an official SpecNovelist reference guide, checklist, or skill manual from the bundled toolkit.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path within the SpecNovelist toolkit."}
            },
            "required": ["path"]
        },
        "handler": tool_read_toolkit_doc
    },
    "specnovel": {
        "description": "Execute a SpecNovelist CLI command (specnovel.py) such as 'status', 'check', 'dag', 'impact', 'next-id', 'delta'. Note: 'accept' is strictly blocked.",
        "parameters": {
            "type": "object",
            "properties": {
                "subcommand": {"type": "string", "description": "Subcommand name (e.g. 'status', 'check', 'next-id')."},
                "args": {"type": "array", "items": {"type": "string"}, "description": "Arguments to pass."}
            },
            "required": ["subcommand"]
        },
        "handler": tool_specnovel
    },
    "fetch_url": {
        "description": "Fetch and extract the readable text/content of a webpage for research.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The HTTP/HTTPS URL to fetch."}
            },
            "required": ["url"]
        },
        "handler": tool_fetch_url
    },
    "ask_user": {
        "description": "Interview the author with structured craft questions and options.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Header for this round of questions."},
                "questions": {
                    "type": "array",
                    "description": "List of questions.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "prompt": {"type": "string"},
                            "options": {"type": "array", "items": {"type": "object", "properties": {"label": {"type": "string"}}}}
                        },
                        "required": ["id", "prompt"]
                    }
                }
            },
            "required": ["questions"]
        },
        "handler": tool_ask_user
    }
}

def normalize_tool_name(name: str) -> str:
    # Strip server prefix if present (e.g. "novelstudio__read_file" or "novelstudio_read_file")
    if name.startswith("novelstudio__"):
        return name[len("novelstudio__"):]
    if name.startswith("novelstudio_"):
        return name[len("novelstudio_"):]
    return name

def handle_request(req: dict) -> dict:
    msg_id = req.get("id")
    method = req.get("method")
    params = req.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "novelstudio",
                    "version": "0.1.0"
                }
            }
        }

    if method == "notifications/initialized":
        return None

    if method == "ping":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {}
        }

    if method == "tools/list":
        tools_list = []
        for name, spec in TOOLS_REGISTRY.items():
            tools_list.append({
                "name": name,
                "description": spec["description"],
                "inputSchema": spec["parameters"]
            })
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "tools": tools_list
            }
        }

    if method == "tools/call":
        raw_name = params.get("name", "")
        tool_name = normalize_tool_name(raw_name)
        tool_args = params.get("arguments", {})

        if tool_name not in TOOLS_REGISTRY:
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [{"type": "text", "text": f"Error: Unknown tool '{raw_name}'"}],
                    "isError": True
                }
            }

        handler = TOOLS_REGISTRY[tool_name]["handler"]
        try:
            output = handler(tool_args)
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [{"type": "text", "text": str(output)}]
                }
            }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [{"type": "text", "text": f"Execution error in {tool_name}: {e}"}],
                    "isError": True
                }
            }

    return {
        "jsonrpc": "2.0",
        "id": msg_id,
        "error": {
            "code": -32601,
            "message": f"Method not found: {method}"
        }
    }

def main():
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            res = handle_request(req)
            if res is not None:
                sys.stdout.write(json.dumps(res) + "\n")
                sys.stdout.flush()
        except Exception as e:
            sys.stderr.write(f"MCP server error: {e}\n")
            sys.stderr.flush()

if __name__ == "__main__":
    main()
