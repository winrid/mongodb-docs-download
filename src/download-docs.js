const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

const HOST = 'https://docs.mongodb.com';
const INDEX = `${HOST}/manual/`;
const CSS_URL = `${HOST}/manual/docs-tools/mongodb-docs.css`;
const PAGE_SCRAPE_LIMIT = 1000;

async function getPageContent(url) {
    console.log('Fetching', url);
    return (await axios.get(url)).data;
}

const Visited = [];

(async function main() {
    const indexContent = await getPageContent(INDEX);
    const indexCheerio = cheerio.load(indexContent);
    const version = indexCheerio('.contains-headerlink')[0].children[2].data;
    console.log('Downloading docs for latest version:', version);

    const targetDir = path.join(__dirname, '..', 'build', version);

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, {
            recursive: true
        });
    }

    const css = await getPageContent(CSS_URL);

    // const sidebarUrls =
    const chapterLinks = []; // We do things in chapters to handle cycles in their docs.

    let nextPageUrl = INDEX;
    let depth = 1;

    while (nextPageUrl && depth <= PAGE_SCRAPE_LIMIT) {
        if (depth === PAGE_SCRAPE_LIMIT) {
            throw new Error(`Page scrape limit of ${PAGE_SCRAPE_LIMIT} Reached! Increase the constant to keep going.`);
        }
        if (Visited.includes(nextPageUrl)) {
            throw new Error('Cycle detected! Do not know how to handle! Page list: ' + JSON.stringify(Visited, null, '    '));
        }
        const content = await getPageContent(nextPageUrl);
        const contentCheerio = cheerio.load(content);
        const contentBodyHTML = cheerio.html(contentCheerio('#main-column .body section'));
        const contentBodyHTMLWithStyles = `<style>${css}</style>${contentBodyHTML}`;
        const title = contentCheerio('title')
            .text()
            .replace('Magnifying Glass Icon', '')
            .replace(new RegExp('/', 'g'), '-')
            .replace(new RegExp('"', 'g'), '');

        const targetFileName = `${depth}-${title}.html`;
        console.log('Saving', targetFileName);
        fs.writeFileSync(path.join(targetDir, targetFileName), contentBodyHTMLWithStyles, 'utf8');

        Visited.push(nextPageUrl);

        const nextPageButtonCheerio = contentCheerio('#btnv .btn-next-text')[0];
        if (nextPageButtonCheerio) {
            nextPageUrl = nextPageButtonCheerio.attribs.href.valueOf();
            if (!nextPageUrl.startsWith('http')) {
                nextPageUrl = HOST + nextPageUrl;
            }
            depth++;
        } else {
            console.log('Could not find next button on', nextPageUrl, ' - stopping.');
            break;
        }
    }

    console.log('Done. Hit depth of', depth);
})();
