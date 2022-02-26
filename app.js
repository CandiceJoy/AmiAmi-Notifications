import {log, logTest}                 from "./DefaultLogger.js";
import fetch                          from "node-fetch";
import {config}                       from "./config.js";
import {createPromise}                from "./PromiseFactory.js";
import {wishlist}                     from "./wishlist.js";
import puppeteer                      from "puppeteer";
import {AmiAmiBrowser, AmiAmiDetails} from "./AmiAmiBrowser.js";
import fs                             from "fs";
import cheerio                        from "cheerio";

import path            from "path";
import {fileURLToPath} from 'url';
import cliProgress     from "cli-progress";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
log.trace("Begin App.js");
const basePath = __dirname;
const itemConditions = ["A", "A-", "B+", "B", "C", "J"];
const boxConditions = ["A", "B", "C", "N"];
const pages = [];
const myWishlist = [];
const myBrowser = await puppeteer.launch();
const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
const screenshotDir = path.join(__dirname, "results");
let numPages;

process.on('uncaughtException', ex => {
	log.fatal(ex.message);
	log.close();
	log.end();
	log.on('finish', () => {
		process.exit(1);
	});
})

if(fs.existsSync(screenshotDir))
{
	fs.rmSync(screenshotDir, {recursive: true});
}
fs.mkdirSync(screenshotDir);

async function getMFCPage(pageNum)
{
	log.trace("getMFCPage start @" + pageNum);
	const $ = await cheerioFetch(
		'https://myfigurecollection.net/users.v4.php?mode=view&username=' + config.mfcUsername +
		'&tab=collection&status=0&current=keywords&rootId=-1&categoryId=-1&output=2&sort=category&order=asc&page=' +
		pageNum);

	if($("body").text().includes("Service Unavailable"))
	{
		throw "MFC Service Unavailable";
	}

	if(!numPages)
	{
		numPages =
			parseInt($("a.nav-last").attr("href").match(new RegExp("(?:&|\\?|&amp;)page=(\\d+)(?:&|\\?|&amp;)?"))[1]);
		log.debug("numPages: " + numPages);
	}

	const items = $(".item-icon");
	//log.data("Items on page: %o", items);

	$(items).find("a").each(function()
	                        {
		                        const href = $(this).attr("href");
		                        const url = "https://myfigurecollection.net" + href;
		                        pages.push(url);
	                        });
	log.trace("getMFCPage end");
}

async function cheerioFetch(url)
{
	log.trace("cheerioFetch begin @" + url);
	const page = await myBrowser.newPage();
	await page.goto(url);
	const content = await page.content();
	await page.close();
	log.trace("cheerioFetch end");
	return cheerio.load(content);
}

async function cheerioScreenshot(url, num)
{
	log.trace("cheerioFetch begin @" + url);
	const page = await myBrowser.newPage();
	await page.goto(url);

	await page.screenshot({
		                      path    : "results/" + num + ".png",
		                      fullPage: true
	                      });

	await page.close();
	log.trace("cheerioFetch end");
}

async function getMFCJancode(url)
{
	log.trace("getMFCJancode begin@ " + url);
	const $ = await cheerioFetch(url);
	//log.data("Meta: %o", $("meta"));
	const metaContent = $("meta[itemprop='productID']").attr("content");

	if(!metaContent)
	{
		log.trace("getMFCJancode end; no jancode");
		return;
	}

	const jancode = metaContent.match("jan:(\\d+)")[1];
	log.data(jancode);
	myWishlist.push(jancode);
	log.trace("getMFCJancode end");
}

log.info("Going through wishlist...");

for(let i = 1; i <= (numPages ? numPages : 1); i++)
{
	if(numPages && !bar1.isActive)
	{
		bar1.start(numPages, 1);
	}

	bar1.increment();
	await getMFCPage(i);
}
bar1.stop();

log.data("URLs to pages: %o", pages);
log.info("Pulling jancodes from wishlist...");
bar1.start(pages.length, 0);

for(let i in pages)
{
	bar1.increment();
	const url = pages[i];
	await getMFCJancode(url);
}
bar1.stop();

log.data("Jancodes: " + myWishlist);

const browser = await new AmiAmiBrowser();
const details = new AmiAmiDetails();
const results = [];
let currentItem;
let i = 0;
let first = true;

log.info("Searching AmiAmi...");

do
{
	log.trace("Main loop start");
	currentItem = await browser.getItem();

	if(first)
	{
		// start the progress bar with a total value of 200 and start value of 0
		bar1.start(browser.results, 0);
		first = false;
	}

	i++;
	// update the current value in your application..
	bar1.increment();

	if(currentItem)
	{
		if(myWishlist.includes(currentItem.jancode))
		{
			const url = "https://www.amiami.com/eng/detail?gcode=" + currentItem.gcode;
			log.debug("Wishlist entry found!  %s: %s", currentItem.gname, url);
			log.debug("Pushing %s - %s", currentItem.gname,url);
			const figureDetails = await details.query(currentItem.gcode).item;
			log.data("figureDetails: %o",figureDetails);
			const sname = figureDetails.sname;
			const matches = sname.match(new RegExp("\\(Pre-owned\\s+ITEM:(\\w+)\\/BOX:(\\w+)\\)"));
			const item = matches[1];
			const box = matches[2];

			results.push([currentItem.gname, url, currentItem.price, item, box]);
		}
	}
	log.trace("Main loop end");
} while(currentItem);

log.trace("Main loop finished");

log.data("Results: %o", results );
// stop the progress bar
bar1.stop();
log.trace("Screenshot start");
log.info("Grabbing screenshots...");
bar1.start(results.length,0);

for(let j = 0; j < results.length; j++)
{
	bar1.increment();
	const resultTuple = results[j];
	const name = resultTuple[0];
	const url = resultTuple[1];
	const price = resultTuple[2];
	const itemCondition = resultTuple[3];
	const boxCondition = resultTuple[4];
	log.debug("[%s] %s (%s item | %s box) - %s",name,price,itemCondition,boxCondition, url);
	await cheerioScreenshot(url, j);
}
log.trace("Screenshot end");
bar1.stop();
await myBrowser.close();