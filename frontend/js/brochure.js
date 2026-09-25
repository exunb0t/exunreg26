function splitTableRow(line) {
  let s = String(line || "").trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|");
}

function isTableDelimiter(line) {
  const cells = splitTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((c) => /^[\s:\-]+$/.test(c) && c.indexOf("-") !== -1);
}

function normalizeTables(md) {
  const lines = String(md || "").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    if (next !== undefined && line.indexOf("|") !== -1 && isTableDelimiter(next)) {
      const head = splitTableRow(line);
      const delim = splitTableRow(next);
      while (head.length < delim.length) head.push("");
      out.push("| " + head.slice(0, delim.length).join(" | ") + " |");
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

function sanitizeBrochureHtml(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html || "");
  const allowed = new Set(["P", "BR", "H1", "H2", "H3", "H4", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "STRONG", "EM", "CODE", "PRE", "A", "BLOCKQUOTE", "HR", "DIV", "SPAN"]);
  const walk = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1) {
        if (!allowed.has(child.tagName)) {
          const frag = document.createDocumentFragment();
          while (child.firstChild) frag.appendChild(child.firstChild);
          node.replaceChild(frag, child);
          walk(frag);
          continue;
        }
        for (const attr of Array.from(child.attributes)) {
          const n = attr.name.toLowerCase();
          if (n.startsWith("on")) child.removeAttribute(attr.name);
        }
        if (child.tagName === "A") {
          const href = child.getAttribute("href") || "";
          if (!/^(https?:\/\/|\/|#)/i.test(href.trim()) || /^javascript:/i.test(href.trim()) || /^data:/i.test(href.trim())) {
            child.removeAttribute("href");
          }
        }
        walk(child);
      } else if (child.nodeType === 8) {
        child.remove();
      }
    }
  };
  walk(tpl.content);
  return tpl.innerHTML;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (document.body.dataset.page !== "brochure") return;
  const contentEl = document.getElementById("html-content");
  const navList = document.getElementById("nav-list");
  try {
    const resp = await fetch("/data/invite.md");
    if (!resp.ok) throw new Error("failed");
    let md = await resp.text();
    md = md.replace(/\\\r?\n/g, "\n");
    md = md.replace(/^\s*-\s*$/gm, "");
    md = normalizeTables(md);
    let html = "";
    if (window.marked) {
      if (typeof window.marked.setOptions === "function") {
        window.marked.setOptions({ gfm: true, tables: true, breaks: false });
      }
      html = window.marked.parse ? window.marked.parse(md) : window.marked(md);
    } else if (window.Utils && typeof window.Utils.renderMarkdown === "function") {
      html = window.Utils.renderMarkdown(md);
    }
    html = sanitizeBrochureHtml(html);
    if (contentEl) contentEl.innerHTML = html;
    if (contentEl) {
      contentEl.querySelectorAll('a[href^="http"]').forEach((a) => {
        a.target = "_blank";
        a.rel = "noopener";
      });
    }
    if (contentEl) {
      contentEl.querySelectorAll("thead").forEach((thead) => {
        const ths = thead.querySelectorAll("th");
        if (ths.length > 0 && Array.from(ths).every((th) => !th.textContent.trim())) thead.remove();
      });
      contentEl.querySelectorAll("table").forEach((table) => {
        const wrap = document.createElement("div");
        wrap.className = "table-scroll";
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      });
    }
    if (contentEl && navList) {
      const headings = Array.from(contentEl.querySelectorAll("h2")).filter((h) => (h.textContent || "").trim());
      const byId = new Map();
      navList.innerHTML = "";
      headings.forEach((h) => {
        const text = (h.textContent || "").trim();
        if (!h.id) {
          h.id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        }
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#" + h.id;
        a.textContent = text;
        li.appendChild(a);
        navList.appendChild(li);
        byId.set(h.id, a);
      });
      if ("IntersectionObserver" in window) {
        const spy = new IntersectionObserver((entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              navList.querySelectorAll("a").forEach((l) => l.classList.remove("active"));
              const a = byId.get(en.target.id);
              if (a) a.classList.add("active");
            }
          });
        }, { rootMargin: "-25% 0px -65% 0px" });
        headings.forEach((h) => spy.observe(h));
      }
      const all = contentEl.querySelectorAll("h1, h3");
      all.forEach((h) => {
        if (!h.id) {
          const text = (h.textContent || "").trim();
          if (text) h.id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        }
      });
      const cleanUrl = () => {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      };
      navList.querySelectorAll("a").forEach((a) => {
        a.addEventListener("click", (e) => {
          const target = document.getElementById(a.getAttribute("href").slice(1));
          if (!target) return;
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          cleanUrl();
        });
      });
      if (window.location.hash) {
        const target = document.getElementById(window.location.hash.slice(1));
        if (target) setTimeout(() => target.scrollIntoView({ block: "start" }), 100);
        cleanUrl();
      }
    }
  } catch (err) {
    if (contentEl) contentEl.innerHTML = "<p>Failed to load brochure.</p>";
  }
});
