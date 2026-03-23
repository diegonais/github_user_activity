#!/usr/bin/env node

/**
 * CLI de Actividad de Usuario de GitHub
 * Uso: node github-activity.js <username>
 *      github-activity <username>
 */

const GITHUB_API_BASE = "https://api.github.com";

// Códigos de color ANSI para la salida en terminal
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

// Mapea cada tipo de evento de GitHub a una descripción legible con ícono
function formatEvent(event) {
  const repo = c("cyan", event.repo.name);
  const payload = event.payload;

  switch (event.type) {
    case "PushEvent": {
      const count = payload.commits?.length ?? 0;
      const branch = payload.ref?.replace("refs/heads/", "") ?? "desconocido";
      return `${c("green", "⬆")}  Pushed ${c("bright", count)} commit${count !== 1 ? "s" : ""} to ${c("yellow", branch)} in ${repo}`;
    }

    case "IssuesEvent": {
      const action = payload.action;
      const issue = `#${payload.issue?.number}`;
      const title = payload.issue?.title ?? "";
      return `${c("magenta", "◉")}  ${capitalize(action)} issue ${c("yellow", issue)} "${title}" in ${repo}`;
    }

    case "IssueCommentEvent": {
      const issue = `#${payload.issue?.number}`;
      const title = payload.issue?.title ?? "";
      return `${c("magenta", "💬")}  Commented on issue ${c("yellow", issue)} "${title}" in ${repo}`;
    }

    case "WatchEvent":
      return `${c("yellow", "★")}  Starred ${repo}`;

    case "ForkEvent": {
      const forkee = payload.forkee?.full_name ?? "unknown";
      return `${c("blue", "⑂")}  Forked ${repo} → ${c("cyan", forkee)}`;
    }

    case "CreateEvent": {
      const refType = payload.ref_type;
      const ref = payload.ref ? ` ${c("yellow", payload.ref)}` : "";
      return `${c("green", "✚")}  Created ${refType}${ref} in ${repo}`;
    }

    case "DeleteEvent": {
      const refType = payload.ref_type;
      const ref = payload.ref ? ` ${c("yellow", payload.ref)}` : "";
      return `${c("red", "✖")}  Deleted ${refType}${ref} in ${repo}`;
    }

    case "PullRequestEvent": {
      const action = payload.action;
      const pr = `#${payload.pull_request?.number}`;
      const title = payload.pull_request?.title ?? "";
      return `${c("blue", "⬡")}  ${capitalize(action)} PR ${c("yellow", pr)} "${title}" in ${repo}`;
    }

    case "PullRequestReviewEvent": {
      const action = payload.review?.state ?? "reviewed";
      const pr = `#${payload.pull_request?.number}`;
      return `${c("blue", "✔")}  ${capitalize(action)} PR ${c("yellow", pr)} in ${repo}`;
    }

    case "PullRequestReviewCommentEvent": {
      const pr = `#${payload.pull_request?.number}`;
      return `${c("blue", "💬")}  Commented on PR ${c("yellow", pr)} in ${repo}`;
    }

    case "ReleaseEvent": {
      const tag = payload.release?.tag_name ?? "unknown";
      return `${c("green", "🏷")}  Released ${c("yellow", tag)} in ${repo}`;
    }

    case "PublicEvent":
      return `${c("green", "🌐")}  Made ${repo} public`;

    case "MemberEvent": {
      const member = payload.member?.login ?? "unknown";
      return `${c("cyan", "👤")}  ${capitalize(payload.action)} ${c("bright", member)} as collaborator in ${repo}`;
    }

    case "CommitCommentEvent":
      return `${c("gray", "💬")}  Commented on a commit in ${repo}`;

    case "GollumEvent": {
      const pages = payload.pages?.length ?? 0;
      return `${c("yellow", "📝")}  Updated ${pages} wiki page${pages !== 1 ? "s" : ""} in ${repo}`;
    }

    default:
      return `${c("gray", "•")}  ${event.type.replace("Event", "")} in ${repo}`;
  }
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchUserActivity(username) {
  const url = `${GITHUB_API_BASE}/users/${username}/events?per_page=30`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "github-activity-cli",
      Accept: "application/vnd.github+json",
    },
  });

  if (response.status === 404) {
    throw new Error(`User "${username}" not found.`);
  }

  if (response.status === 403) {
    const remaining = response.headers.get("X-RateLimit-Remaining");
    const reset = response.headers.get("X-RateLimit-Reset");
    const resetTime = reset
      ? new Date(parseInt(reset) * 1000).toLocaleTimeString()
      : "unknown";
    throw new Error(
      `GitHub API rate limit exceeded. Resets at ${resetTime}. Remaining: ${remaining}`
    );
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const events = await response.json();
  return events;
}

function printHeader(username) {
  const title = ` GitHub Activity — ${username} `;
  const line = "─".repeat(title.length + 2);
  console.log();
  console.log(c("cyan", `┌${line}┐`));
  console.log(c("cyan", "│ ") + c("bright", title) + c("cyan", " │"));
  console.log(c("cyan", `└${line}┘`));
  console.log();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(c("red", "Error:") + " Please provide a GitHub username.");
    console.error(c("gray", "Usage: ") + "github-activity <username>");
    process.exit(1);
  }

  const username = args[0];

  // Validación básica del nombre de usuario
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
    console.error(c("red", "Error:") + ` "${username}" is not a valid GitHub username.`);
    process.exit(1);
  }

  printHeader(username);
  console.log(c("gray", `Fetching activity for ${username}...`));

  try {
    const events = await fetchUserActivity(username);

    if (events.length === 0) {
      console.log(
        c("yellow", "No recent public activity found for this user.")
      );
      return;
    }

    console.log(
      c("gray", `Showing ${events.length} most recent public event(s):\n`)
    );

    events.forEach((event, index) => {
      const num = c("gray", `${String(index + 1).padStart(2, " ")}.`);
      const date = c("gray", `  [${formatDate(event.created_at)}]`);
      console.log(`${num} ${formatEvent(event)}`);
      console.log(`    ${date}`);
    });

    console.log();
  } catch (error) {
    if (error.cause?.code === "ENOTFOUND" || error.message.includes("fetch")) {
      console.error(
        c("red", "Error:") + " Could not connect to GitHub. Check your internet connection."
      );
    } else {
      console.error(c("red", "Error:") + " " + error.message);
    }
    process.exit(1);
  }
}

main();
