import {log} from "./DefaultLogger.js";
import fetch from "node-fetch";
import {config} from "./config.js";
import {wishlist} from "./wishlist.js";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

log.trace("Begin App.js");
const basePath = __dirname;

(async () => {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.goto('https://www.amiami.com/eng/search/list/?s_st_condition_flg=1&s_sortkey=regtimed&pagecnt=1&s_cate_tag=14');
	await page.screenshot({ path: basePath + "/test.png" });
	await browser.close();
})();

const options = {
	headers:{
		"x-user-key": "amiami_dev"
	},
	method:"GET"
};

const params = {
	s_st_condition_flg: 1,
	s_cate_tag: 14,
	pagecnt:1,
	lang:"eng"
};

let paramString = "?";

for( const key in params )
{
	const value = params[key];
	paramString += `&${key}=${value}`;
}

const url = config.baseUrl + paramString;

log.info("URL: %j",url);
const response = await fetch(url, options);
const data = await response.json();
log.debug("Data: %o",data);

/*
 //amiami.addHeader("x-user-key", "amiami_dev");
 Params params = new Params();
 params.add("s_st_condition_flg", 1);
 params.add("s_cate_tag", 14);
 params.add("pagecnt", 1);
 params.add("lang", "eng");

 if (KEYWORDS != null) {
 params.add("s_keywords", KEYWORDS);
 }
 */

//console.log(data);