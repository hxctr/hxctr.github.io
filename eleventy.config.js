module.exports = function (eleventyConfig) {
    eleventyConfig.addFilter("readableDate", (dateObj) => {
        return new Date(dateObj).toLocaleDateString("es-GT", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
        });
    });

    eleventyConfig.addPassthroughCopy("src/css");
    eleventyConfig.addPassthroughCopy("src/images");
    eleventyConfig.addPassthroughCopy("src/icons");
    eleventyConfig.addPassthroughCopy("src/media");
    eleventyConfig.addPassthroughCopy("src/certs");
    eleventyConfig.addPassthroughCopy("src/js");

    eleventyConfig.addGlobalData("certificates", () => {
        const fs = require("fs");
        const path = require("path");
        const certsDir = path.join(__dirname, "src/certs");
        if (!fs.existsSync(certsDir)) return [];
        return fs
            .readdirSync(certsDir)
            .filter((file) => file.toLowerCase().endsWith(".pdf"))
            .sort()
            .map((file) => ({
                file,
                url: `/certs/${file}`,
                name: path
                    .basename(file, ".pdf")
                    .replace(/[-_]+/g, " ")
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" "),
            }));
    });

    eleventyConfig.addGlobalData("heroPhotos", () => {
        const fs = require("fs");
        const path = require("path");
        const heroDir = path.join(__dirname, "src/images/hero");
        if (!fs.existsSync(heroDir)) return [];
        const extensions = [".jpg", ".jpeg", ".png", ".webp"];
        return fs
            .readdirSync(heroDir)
            .filter((file) => extensions.includes(path.extname(file).toLowerCase()))
            .sort()
            .map((file) => `/images/hero/${file}`);
    });

    eleventyConfig.addCollection("writeups", (collectionApi) => {
        return collectionApi
            .getFilteredByGlob("src/writeups/notes/*.md")
            .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
    });

    return {
        markdownTemplateEngine: false,
        dir: {
            input: "src",
            includes: "_includes",
            output: "_site",
        },
    };
};
