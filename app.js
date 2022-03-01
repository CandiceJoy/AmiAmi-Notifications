import {format}                       from '@fast-csv/format';
import cheerio                        from "cheerio";
import cliProgress                    from "cli-progress";
import fs                             from "fs";
import path                           from "path";
import puppeteer                      from "puppeteer";
import {fileURLToPath}                from 'url';
import {AmiAmiBrowser, AmiAmiDetails} from "./AmiAmiBrowser.js";
import {config}                       from "./config.js";
import {log}                          from "./DefaultLogger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
log.trace("Begin App.js");
let itemsOnPage = [];
const myWishlist = [];
const myBrowser = await puppeteer.launch();
const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
const screenshotDir = path.join(__dirname, "results");
const mfcCacheFile = "./mfcUrlCache.json";
const mfcPageCacheFile = "./mfcPageCache.json";
const results = [];
let numPages;
let mfcUrlCache;

process.on('uncaughtException', ex =>
{
	log.fatal(ex.message);
	log.on('finish', () =>
	{
		process.exit(1);
	});
});

getWishlistPages();

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
		                        itemsOnPage.push(url);
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
	await page.waitForNetworkIdle();
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
	const cache = mfcUrlCache[url];

	if(cache || cache === null)
	{
		log.trace("getMFCJancode end; cache match");

		if(cache !== null)
		{
			myWishlist.push(cache);
		}

		return;
	}

	const $ = await cheerioFetch(url);
	//log.data("Meta: %o", $("meta"));
	const metaContent = $("meta[itemprop='productID']").attr("content");

	if(!metaContent)
	{
		mfcUrlCache[url] = null;
		writeFile(mfcCacheFile, mfcUrlCache);
		log.trace("getMFCJancode end; no jancode");
		return;
	}

	const jancode = metaContent.match("jan:(\\d+)")[1];
	log.data(jancode);

	if(!myWishlist.includes(jancode))
	{
		myWishlist.push(jancode);
		mfcUrlCache[url] = jancode;
		writeFile(mfcCacheFile, mfcUrlCache);
	}

	log.trace("getMFCJancode end");
}

function getWishlistPages()
{
	log.info("Going through wishlist pages...");
	const pageCache = readFile(mfcPageCacheFile);
	const promises = [];

	if(pageCache)
	{
		log.info("Cache found; delete " + mfcPageCacheFile + " to refresh");
		itemsOnPage = pageCache;
		getJancodes();
		return;
	}

	for(let i = 1; i <= (numPages ? numPages : 1); i++)
	{
		if(numPages && !bar1.isActive)
		{
			bar1.start(numPages, 1);
		}

		bar1.increment();
		promises.push(getMFCPage(i));
	}
	log.info(promises);
	Promise.all(promises).then(() =>
	                           {
		                           bar1.stop();
		                           writeFile(mfcPageCacheFile, itemsOnPage);
		                           log.data("URLs to pages: %o", itemsOnPage);
		                           getJancodes();
	                           });
}

async function getJancodes()
{
	log.info("Pulling jancodes from wishlist...");
	const cache = readFile(mfcCacheFile);
	const promises = [];

	if(cache)
	{
		mfcUrlCache = cache;
	}
	else
	{
		mfcUrlCache = {};
	}

	bar1.start(itemsOnPage.length, 0);

	for(let i in itemsOnPage)
	{
		bar1.increment();
		const url = itemsOnPage[i];
		promises.push(getMFCJancode(url));
	}

	Promise.all(promises).then(() =>
	                           {
		                           bar1.stop();
		                           log.data("Jancodes: " + myWishlist);
		                           getStoreData();
	                           });
}

async function getStoreData()
{
	const browser = await new AmiAmiBrowser();
	const details = new AmiAmiDetails();
	let currentItem;
	let i = 0;
	let first = true;
	const promises = [];

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
		if(currentItem && myWishlist.includes(currentItem.jancode))
		{
			const url = "https://www.amiami.com/eng/detail?gcode=" + currentItem.gcode;
			const gname = currentItem.gname;

			log.debug("Wishlist entry found!  %s: %s", currentItem.gname, url);
			log.debug("Pushing %s - %s", currentItem.gname, url);

			promises.push(details.query(currentItem.gcode).then((res) =>
			                                                    {
				                                                    const figureDetails = res.item;
				                                                    //log.info( "Result: %o",figureDetails);
				                                                    log.data("figureDetails: %o", figureDetails);
				                                                    const sname = figureDetails.sname;
				                                                    const matches = sname.match(new RegExp(
					                                                    "\\(Pre-owned\\s+ITEM:(\\w[+-]?)\\/BOX:(\\w[+-]?)\\)"));

				                                                    if(matches === null)
				                                                    {
					                                                    log.info("figureDetails: %o", figureDetails);
					                                                    log.info("Sname: %s", sname);
					                                                    log.info("Matches: %o", matches);
					                                                    process.exit(1);
				                                                    }

				                                                    const item = matches[1];
				                                                    const box = matches[2];

				                                                    results.push( //TODO: Fix price
				                                                                  [gname, url, figureDetails.price,
				                                                                   item, box,
				                                                                   figureDetails.maker_name]);
			                                                    }));
			/*const figureDetails = await details.query(currentItem.gcode).item;
			 log.info("figureDetails: %o", figureDetails);
			 log.data("figureDetails: %o", figureDetails);
			 const sname = figureDetails.sname;
			 const matches = sname.match(new RegExp("\\(Pre-owned\\s+ITEM:(\\w+)\\/BOX:(\\w+)\\)"));
			 const item = matches[1];
			 const box = matches[2];

			 results.push([currentItem.gname, url, currentItem.price, item, box]);*/
		}
		log.trace("Main loop end");
	} while(currentItem);

	Promise.all(promises).then(() =>
	                           {
		                           log.trace("Main loop finished");

		                           log.data("Results: %o", results);
		                           bar1.stop();
		                           doScreenshots();
	                           });
}

async function doScreenshots()
{
	log.trace("Screenshot start");
	if(fs.existsSync(screenshotDir))
	{
		fs.rmSync(screenshotDir, {recursive: true});
	}
	fs.mkdirSync(screenshotDir);
	log.info("Grabbing screenshots...");
	bar1.start(results.length, 0);
	const promises = [];

	for(let j = 0; j < results.length; j++)
	{
		bar1.increment();
		const resultTuple = results[j];
		const url = resultTuple[1];

		promises.push(cheerioScreenshot(url, j));
	}
	Promise.all(promises).then(() =>
	                           {
		                           log.trace("Screenshot end");
		                           writeResults();
		                           bar1.stop();
		                           myBrowser.close();
	                           });
}

function writeResults()
{
	const csvFile = fs.createWriteStream("./results.csv");

	const output = [];
	const stream = format({headers: true});
	stream.pipe(csvFile);

	for(let i = 0; i < results.length; i++)
	{
		const result = results[i];
		output.push({
			            name         : result[0],
			            brand        : result[5],
			            url          : result[1],
			            price        : result[2],
			            itemCondition: result[3],
			            boxCondition : result[4]
		            });
		stream.write(output[i]);
	}

	stream.end();
}

function writeFile(file, data)
{
	fs.writeFileSync(file, JSON.stringify(data));
}

function readFile(file)
{
	if(fs.existsSync(file))
	{
		return JSON.parse(fs.readFileSync(file, {
			encoding: "utf8",
			flag    : "r"
		}));
	}
	else
	{
		return undefined;
	}
}