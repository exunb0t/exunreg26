document.addEventListener("DOMContentLoaded", async function () {
  const rows = document.querySelectorAll("#sponsors-row");
  if (rows.length > 0) {
    try {
      const resp = await fetch("/data/sponsors.json");
      if (resp.ok) {
        const data = await resp.json();
        const list = Array.isArray(data) ? data : (data.sponsors || []);
        const html = list.map((s) => {
          const rawHref = s.link || s.Link || "#";
          const rawSrc = s.imageUrl || s.ImageURL || s.image || "";
          const href = Utils.isAllowedUrl(rawHref) ? rawHref : "#";
          const src = Utils.isAllowedUrl(rawSrc) || rawSrc.startsWith("/") ? rawSrc : "";
          const alt = s.alt || s.Alt || "Sponsor";
          const height = s.height || s.Height || "80px";
          return `<a href="${Utils.escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="sponsor-link"><img src="${Utils.escapeHtml(src)}" alt="${Utils.escapeHtml(alt)}" class="sponsor-img" data-height="${Utils.escapeHtml(height)}" loading="lazy" /></a>`;
        }).join("");
        rows.forEach((row) => {
          row.innerHTML = html;
        });
        sizeSponsorImages();
      }
    } catch (e) {}
  }
  sizeSponsorImages();
});

function sizeSponsorImages() {
  var imgs = document.querySelectorAll('.sponsor-img');
  for (var i = 0; i < imgs.length; i++) {
    var img = imgs[i];
    var h = img.getAttribute('data-height');
    if (!h) h = '80px';
    img.style.maxHeight = h;
    img.style.height = 'auto';
    img.style.width = 'auto';
    img.style.maxWidth = '100%';
  }
}
