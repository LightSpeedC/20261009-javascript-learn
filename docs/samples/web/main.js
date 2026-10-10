const title = document.querySelector("#title");
const button = document.querySelector("#change");
button.addEventListener("click", () => {
  title.textContent = "JavaScript から書き換えました";
});
console.log("準備ができました");
