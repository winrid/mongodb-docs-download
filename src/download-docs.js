const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const sanitizeFileNameLibrary = require('sanitize-filename');

const HOST = 'https://docs.mongodb.com';
const INDEX = `${HOST}/manual/`;
const CSS_URL = `${HOST}/manual/docs-tools/mongodb-docs.css`;
const PAGE_SCRAPE_LIMIT = 5000;

async function getPageContent(url) {
    console.log('Fetching', url);
    return (await axios.get(url)).data;
}

function sanitizeFileName(text) {
    if (text.startsWith('/')) {
        text = text.substring(1);
    }
    return sanitizeFileNameLibrary(text.replace('Magnifying Glass Icon', '')
        .replace(new RegExp('/', 'g'), '-')
        .replace(new RegExp(':', 'g'), '-')
        .replace(new RegExp('--', 'g'), '-')
        .replace(new RegExp('"', 'g'), ''));
}

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

    // TODO could DFS sidebar links to reduce a lot of complexity here.

    const chapterLinks = indexCheerio('.sidebar .current .reference').map((_, a) => {
        let href = a.attribs.href;
        if (!href.startsWith('/')) {
            href = '/' + href;
        }
        return `${HOST}${href}`;
    }).toArray(); // We do things in chapters to handle cycles in their docs.

    const JumpMap = {
        [`${HOST}/faq`]: `${HOST}/manual/faq/fundamentals/`, // will 404...
        [`${HOST}/release-notes`]: `${HOST}/manual/release-notes/${version}/`, // will 404...
        [`${HOST}/reference`]: `${HOST}/manual/reference/operator/query/` // will 404...
    };

    let nextPageUrl = INDEX;
    let chapterName = '';
    let chapterIndex = 0;
    let depth = 1;
    let Visited = [];
    const VisitedChapters = [];

    while (nextPageUrl && depth <= PAGE_SCRAPE_LIMIT) {
        if (Visited.includes(nextPageUrl)) { // on cycle detect, just jump to next chapter (TODO hack!)
            Visited = [];
            chapterIndex++;
            if (chapterIndex > chapterLinks.length - 1) {
                throw new Error('Could not skip to next chapter, at end!');
            }
            nextPageUrl = chapterLinks[chapterIndex];
            console.log('Jumping to', nextPageUrl);
            const chapterUrlRelative = nextPageUrl.replace(HOST, '');
            chapterName = sanitizeFileName(chapterUrlRelative);
            if (VisitedChapters.includes(chapterName)) {
                console.warn(`Chapter cycle detected at ${nextPageUrl}! Will skip to next chapter! Chapter list: ${JSON.stringify(VisitedChapters, null, '    ')}`);
            } else {
                VisitedChapters.push(chapterName);
            }
        } else if (chapterLinks.includes(nextPageUrl)) { // is this jumping to another chapter? force it to be the next one to prevent cycles.
            Visited = [];
            chapterIndex++;
            if (chapterIndex > chapterLinks.length - 1) {
                throw new Error('Could not skip to next chapter, at end!');
            }
            const chapterUrlRelative = nextPageUrl.replace(HOST, '');
            chapterName = sanitizeFileName(chapterUrlRelative);
            console.log('Next chapter', chapterName, 'from', nextPageUrl);
            if (VisitedChapters.includes(chapterName)) {
                console.warn(`Chapter cycle detected at ${nextPageUrl}! Will skip to next chapter! Chapter list: ${JSON.stringify(VisitedChapters, null, '    ')}`);
                const skipTo = chapterLinks[chapterIndex];
                console.warn('Jumping to', skipTo);
                nextPageUrl = skipTo;
            } else {
                VisitedChapters.push(chapterName);
            }
        }
        if (JumpMap[nextPageUrl]) {
            nextPageUrl = JumpMap[nextPageUrl];
        }
        if (depth === PAGE_SCRAPE_LIMIT) {
            throw new Error(`Page scrape limit of ${PAGE_SCRAPE_LIMIT} Reached! Increase the constant to keep going.`);
        }
        if (Visited.includes(nextPageUrl)) {
            throw new Error('Cycle detected! Do not know how to handle! Page list: ' + JSON.stringify(Visited, null, '    '));
        }
        const content = await getPageContent(nextPageUrl);
        const contentCheerio = cheerio.load(content);
        const contentBodyHTML = cheerio.html(contentCheerio('#main-column .body section')).replace(new RegExp(`href="${HOST}`, 'g'), `href="`);
        const contentBodyHTMLWithStyles = `<style>${css}</style>${contentBodyHTML}`;
        const title = sanitizeFileName(contentCheerio('title').text());

        const targetFileName = `${depth}-${chapterName}-${title}.html`;
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
