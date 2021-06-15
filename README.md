# mongodb-docs-download

#### Note - Documentation Available to Download from MongoDB!

You can now download an epub of the Mongo docs here: https://docs.mongodb.com/v4.4/mongodb-manual-master.epub

Old documentation is available here: http://dl.mongodb.org/dl/docs/

### What is This?
Mongo stopped providing their documentation in PDF format.

I wanted the documentation on my E-Reader, since I already sit at the computer enough. :)

Trying to compile the HTML files from their documentation, using their documentation, doesn't work, as their Python tools
have versioning issues (a tool requiring Python 2, which requires a version of a tool which requires Python 3).

I'm not a Python expert, and after two hours I gave up and wrote this in less time.

It's just a simple web scraper that looks for and consumes certain elements of MongoDB's documentation.

### What does this do?

It scrapes Mongo's documentation website and downloads the main content of the page as HTML files.

You can then read these offline, or turn them into PDF/E-Book format using a number of different tools.

### How do I use it?

    npm install
    npm run download-docs
    open downloads/v4.4

To get on your Kindle, first use Sigil to create the epub file, and then convert the epub to Kindle format using Calibre.

### Why isn't the latest version just included in this repo?

We can provide the tool, but we can't host Mongo's own docs for licensing safety.
