import fetch    from "node-fetch";
import {config} from "./config.js";
import {log}    from "./DefaultLogger.js";

export class AmiAmiBrowser
{
	constructor(params = {
		s_st_condition_flg: 1,
		s_cate_tag        : 14,
		lang              : "eng"
	})
	{
		log.trace("Begin browser constructor");
		this.url = config.baseUrl + config.endpoints.search;
		this.params = params;

		this.options = {
			headers: {
				"x-user-key": "amiami_dev"
			},
			method : "GET"
		};
		this.page = 1;
		log.trace("End browser constructor");
	}

	async query(page)
	{
		log.trace("Begin browser query @ " + page);
		let params = "";
		let first = true;

		for(let key in this.params)
		{
			let value = this.params[key];
			params += ((first) ? "?" : "&") + key + "=" + value;
			first = false;
		}

		let url = this.url + params + ((first) ? "?" : "&") + "pagecnt=" + page;

		log.debug("Browser URL: %s", url);
		const response = await fetch(url, this.options);
		const data = await response.json();
		log.data("Browser Data: %o", data);
		this.data = data;

		if(!this.results)
		{
			this.results = data.search_result.total_results;
		}

		log.trace("End browser query");
		return;
	}

	async getItem()
	{
		log.trace("Begin browser getItem");
		let count = this.count;

		if(!this.data || !this.data.items || this.count >= this.data.items.length)
		{
			await this.query(this.page);
			this.page++;
			this.count = 0;
			count = 0;
		}

		this.count++;
		log.data("Browser Item: %o", this.data.items[count]);
		log.trace("End browser getItem");
		return this.data.items[count];
	}
}

export class AmiAmiDetails
{
	constructor()
	{
		log.trace("Begin detail constructor");
		this.options = {
			headers: {
				"x-user-key": "amiami_dev"
			},
			method : "GET"
		};
		this.url = config.baseUrl + config.endpoints.details;
		log.trace("End detail constructor");
	}

	async query(gcode)
	{
		log.trace("Begin detail query @ " + gcode);
		let url = this.url + "?gcode=" + gcode;
		log.debug("Detail URL: %s", url);
		const response = await fetch(url, this.options);
		const data = await response.json();
		log.data("Detail Data: %o", data);
		log.trace("End detail query");
		return data;
	}
}