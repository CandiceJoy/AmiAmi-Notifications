import {log, logTest}  from "./DefaultLogger.js";
import fetch           from "node-fetch";
import {config}        from "./config.js";
import {wishlist}      from "./wishlist.js";
import puppeteer                      from "puppeteer";
import {AmiAmiBrowser, AmiAmiDetails} from "./AmiAmiBrowser.js";
import fs                             from "fs";
import jsdom from "jsdom";
const { JSDOM } = jsdom;
import path            from "path";
import {fileURLToPath} from 'url';
import cliProgress from "cli-progress";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

log.trace("Begin App.js");
const basePath = __dirname;
const itemConditions = ["A", "A-", "B+", "B", "C", "J"];
const boxConditions = ["A", "B", "C", "N"];

const pages = [];

 const myBrowser = await puppeteer.launch();
 const page = await myBrowser.newPage();
 await page.goto('https://myfigurecollection.net/users.v4.php?mode=view&username=CandiceJoy&tab=collection&page=1&status=0&current=keywords&rootId=-1&categoryId=-1&output=2&sort=category&order=asc');
 await page.screenshot({ path: basePath + "/test.png" });
 const content = await page.content();

 const {window} = new JSDOM(content);
 //log.info("Window: %o",window);
const { doc } = (new JSDOM(content)).window;

	const items = doc.querySelectorAll(".item-icon");
	log.data("Items on page: %o",items);

	for( let key in items )
	{
		const item = items[key];
		const href = item.firstElementChild.href;
		const url = "https://myfigurecollection.net"+href;
		pages.push(url);
	}

 log.data("URLs to pages: %o", pages);

 await browser.close();

process.exit(0);

const browser = await new AmiAmiBrowser();
const details = new AmiAmiDetails();
const results = [];
let currentItem;
let i = 0;
let first = true;

// create a new progress bar instance and use shades_classic theme
const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);



do
{
	log.trace("Main loop start");
	currentItem = await browser.getItem();

	if( first )
	{
		// start the progress bar with a total value of 200 and start value of 0
		bar1.start(browser.results, 0);
		first = false;
	}

	i++;
	// update the current value in your application..
	bar1.increment();

	if( currentItem )
	{
		if(wishlist.find(wishlistMatch.bind(this,currentItem)))
		{
			const detail = await getDetails( currentItem.gcode );
			checkItem(detail.item);
		}
	}
	log.trace("Main loop end");
}while( currentItem );

// stop the progress bar
bar1.stop();

for( let j in results )
{
	const result = results[j];
	log.info(result);
}

function checkItem(item)
{
	log.trace("checkItem start");
	const conditionName = item.sname;
	const condition = conditionName.match(new RegExp("^\\(Pre-owned ITEM:(\\w[-+]?)\\/BOX:(\\w[-+]?)\\).*$"));
	const itemCondition = condition[1];
	const boxCondition = condition[2];
	const itemConditionNum = itemConditions.indexOf(itemCondition);
	const boxConditionNum = boxConditions.indexOf(boxCondition);

	const wishlistEntry = wishlist.find(wishlistMatch.bind(this,item));
	const allowedItemConditionNum = itemConditions.indexOf(wishlistEntry.allowedItemCondition);
	const allowedBoxConditionNum = boxConditions.indexOf(wishlistEntry.allowedBoxCondition);

	if( itemConditionNum > allowedItemConditionNum || boxConditionNum > allowedBoxConditionNum )
	{
		log.trace("checkItem end; bad condition");
		return;
	}

	const price = item.price;
	const allowedPrice = wishlistEntry.price;

	if( price > allowedPrice )
	{
		log.trace("checkItem end; price too high");
		return;
	}
	const url = "https://www.amiami.com/eng/detail?gcode="+item.gcode;
	log.debug( "Wishlist entry found!  %s: %s",wishlistEntry.name, url);

	results.push( wishlistEntry.name + ": " + url );
	log.trace("checkItem end");
}

function wishlistMatch(wishlistItem,item)
{
	log.trace("In wishlistMatch ("+wishlistItem.jancode+"==="+item.jancode+")");
	if(wishlistItem.jancode === item.jancode)
	{
		return true;
	}
	else
	{
		return false;
	}
}

async function getDetails(item)
{
	return await details.query( item );
}