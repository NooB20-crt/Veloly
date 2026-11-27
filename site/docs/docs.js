const input = document.getElementById("doc-search");
const sections = [...document.querySelectorAll("main section[data-search]")];
const links = [...document.querySelectorAll(".side-link")];
const empty = document.getElementById("search-empty");
const quickGrid = document.querySelector(".quick-grid");

function searchDocs() {
  const query = input.value.trim().toLowerCase();
  let matches = 0;
  for (const section of sections) {
    const visible = !query || `${section.dataset.search} ${section.textContent}`.toLowerCase().includes(query);
    section.classList.toggle("search-hidden", !visible);
    matches += Number(visible);
  }
  quickGrid.classList.toggle("search-hidden", !!query);
  for (const link of links) {
    const section = document.querySelector(link.getAttribute("href"));
    link.classList.toggle("search-hidden", !!query && (!section || section.classList.contains("search-hidden")));
  }
  empty.hidden = !query || matches > 0;
}

input.addEventListener("input", searchDocs);
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")) {
    event.preventDefault();
    input.focus();
  }
  if (event.key === "Escape" && document.activeElement === input) {
    input.value = "";
    searchDocs();
    input.blur();
  }
});

const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  for (const link of links) link.classList.toggle("active", link.hash === `#${visible.target.id}`);
}, { rootMargin: "-15% 0px -70% 0px", threshold: [0, .25, .5, 1] });
for (const section of sections) observer.observe(section);
