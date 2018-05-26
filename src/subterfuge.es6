function Subterfuge_Utils() {

}
Subterfuge_Utils.prototype.ucfirst = function(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
Subterfuge_Utils.prototype.getHash = function() {
	let hash = window.location.hash;//?
	//let hash = document.location.hash;
	if (hash[0] == '#') hash = hash.substring(1);
	if (hash[0] == '!') hash = hash.substring(1);
	return hash;
}
Subterfuge_Utils.prototype.getLocation = function(url) {
	if (url.indexOf('?') !== -1) url = url.split('?')[0];
	return url;
}
Subterfuge_Utils.prototype.randomID = function(maxLen) {
	maxLen = maxLen || 5
	var text = "";
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (var i = 0; i < maxLen; i++)
		text += chars.charAt(Math.floor(Math.random() * chars.length));
	return text;
}

/* Native version */
Subterfuge_Utils.prototype.getSearchParams = function(url) {
	if (!url) return { }
	if (url.indexOf('?') !== -1) url = url.split('?')[1];
	var params = { }
	var extractor = new URLSearchParams(url);
	var entries = extractor.entries();
	for (let pair of entries) params[pair[0]] = pair[1];
	return params;
}
/* Regexp version */
Subterfuge_Utils.prototype._getSearchParams = function(query) {
	if (!query) return { };
	return (/^[?#]/.test(query) ? query.slice(1) : query)
	.split('&')
	.reduce((params, param) => {
		let [ key, value ] = param.split('=');
		params[key] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
		return params;
	}, { });
}
/* Select correct version */
if (!('URLSearchParams' in window)
	|| !('entries' in URLSearchParams.prototype)) {

	Subterfuge_Utils.prototype.getSearchParams =
		Subterfuge_Utils.prototype._getSearchParams;
}

Subterfuge_Utils.prototype.readFileAs = function(file, type) {
	return new Promise((resolve, reject) => {
		var reader = new FileReader();
		reader.onload = function(event) {
			resolve(event.target.result);
		}
		reader.onerror = reject;
		reader['readAs' + type](file);
	});
}


function Subterfuge(options) {
	this.utils = new Subterfuge_Utils();

	let adapter_type = options['adapter'] || Subterfuge_Noop_Adapter;
	let adapter_options = options['adapter_options'] || options['adapter_config'] || { };

	if (typeof adapter_type == 'string') {
		adapter_type = 'Subterfuge_'
			+ this.utils.ucfirst(adapter_type)
			+ '_Adapter';
		adapter_type = window[adapter_type];
	}

	this.adapter = new adapter_type(adapter_options, this);
	this.react_root = options['react_root'] || document.getElementById('root');
	this.store = window.sessionStorage;
	this.use_history = undefined;
	this.use_initial_hash = options['use_initial_hash'] || true;
	this.use_title = options['use_title'] || true;
	this.title_prefix = options['title_prefix'] || '';
	this.title_suffix = options['title_suffix'] || ' - Subterfuge';

	this.onHistoryPop = this.onHistoryPop.bind(this);
	this.useHistory(options['use_history'] || true);

	if (!this.adapter.bulkdelete)
		this.adapter.prototype = this._bulkdeleteAuto;

	this.uri2title = { }

	this.data_cache = { }
	this.data_cache['stf'] = this;
	this.data_cache['messages'] = [ ];
	this.data_cache['pending'] = 0;
	this.data_cache['title'] = '';
	this.data_cache['history'] = [ ];
	this.data_cache['history_cursor'] = -1;
	this.data_cache['bookmarks'] = [ ];

	this.data_cache['side_tab'] = 'history';

	this.bookmarks = [ ];
	this.loadBookmarks();
}

Subterfuge.prototype.reflowBookmarks = function() {
	this.data_cache['bookmarks'] = [ ];
	for (var i = 0; i < this.bookmarks.length; i++) {
		this.data_cache['bookmarks'][i] = {
			'title': this.uri2title[this.bookmarks[i]],
			'href': this.bookmarks[i],
		} 
	}
}
Subterfuge.prototype.loadBookmarks = function() {
	let str = this.store.getItem('bookmarks');
	if (!str) return;
	let parts = str.split("\n");
	for (var i = 0; i < parts.length; i++) {
		this.bookmarks[i] = parts[i];	
	}
	this.reflowBookmarks();
}
Subterfuge.prototype.saveBookmarks = function() {
	let str = this.bookmarks.join("\n");
	this.store.setItem('bookmarks', str);
}
Subterfuge.prototype.addBookmark = function(url, title) {
	if (!title) title = url;
	this.uri2title[url] = title;
	if (this.bookmarks.indexOf(url) !== -1) return;
	this.bookmarks.push(url);
	this.reflowBookmarks();
}
Subterfuge.prototype.delBookmark = function(url) {
	let ind = this.bookmarks.indexOf(url);
	if (ind == -1) return;
	this.bookmarks.splice(ind, 1);
	this.reflowBookmarks();
}
Subterfuge.prototype.toggleBookmark = function(url, title) {
	if (this.isBookmarked(url))
		this.delBookmark(url);
	else
		this.addBookmark(url, title);
	this.redraw();
}
Subterfuge.prototype.isBookmarked = function(url) {
	return this.bookmarks.indexOf(url) === -1 ? false : true;
}

Subterfuge.prototype.checkRQ = function() {
	return this.data_cache['pending'];
}
Subterfuge.prototype.pushRQ = function() {
	this.data_cache['pending'] += 1;
}
Subterfuge.prototype.popRQ = function() {
	this.data_cache['pending'] -= 1;
}

Subterfuge.prototype.addMessage = function(text, cls, info) {
	this.data_cache['messages'].push({
		'id':    this.message_id++,
		'text':  text,
		'cls':   cls, //error|warning|success
		'error': info,
	});
	if (this.data_cache['messages'].length > 20) {
		this.data_cache['messages'].shift();
	}
}
Subterfuge.prototype.clearMessages = function() {
	this.data_cache['messages'] = [ ];
}

/* History Manager */
Subterfuge.prototype.useHistory = function(v) {
	if (this.use_history != v) {
		this.use_history = v;
		if (v == true) window.addEventListener('popstate', this.onHistoryPop);
		else window.removeEventListener('popstate', this.onHistoryPop);
	}
}
Subterfuge.prototype.onHistoryPop = function(e) {
	for (var i = 0; i < this.data_cache['history'].length; i++) {
		let entry = this.data_cache['history'][i];
		if (entry.marker == e.state.marker) {
			this.data_cache['history_cursor'] = i;
			break;
		}
	}

	let hash = this.utils.getHash();

	let title = this.uri2title[ hash ] || e.state.title;

	this.route(hash, "internal", false, title);
}
Subterfuge.prototype.historyPush = function(url, title) {
	let dc = this.data_cache;
	if (!title) title = url;
	if (dc['history_cursor'] < dc['history'].length + 1) {
		dc['history'] = dc['history'].slice(0, dc['history_cursor'] + 1);
	}
	let marker = dc['history_cursor'] + this.utils.randomID(10);
	dc['history'].push({
		'href': url,
		'title': title,
		'marker': marker,
	});
	dc['history_cursor'] = dc['history'].length - 1;
	let max_len = 50;
	if (this.use_history) {
		history.pushState({
			'marker': marker,
			'title': title,
		}, null, '#!' + url);
		//max_len = history.length;
	}
	let len = dc['history'].length;
	let excess = len - max_len;
	if (excess > 0) {
		dc['history'] = dc['history'].slice(-max_len);
		dc['history_cursor'] -= excess;
	}
}

Subterfuge.prototype.historyJump = function(nhc, internal, keepmsg) {
	let hc = this.data_cache['history_cursor'];
	if (nhc >= this.data_cache['history'].length || nhc < 0) {
		return;
	}
	if (hc == nhc && !internal) return;

	let url = this.data_cache['history'][ nhc ][ 'href' ];
	let step = nhc - hc;

	if (!this.use_history || step == 0) {
		this.data_cache['history_cursor'] = nhc;
		this.route(url, internal, keepmsg);
	}
	else if (this.use_history) {
		window.history.go(step);
	}
}
Subterfuge.prototype.historyGo = function(step, internal, keepmsg) {
	return this.historyJump(this.data_cache['history_cursor'] + step, internal, keepmsg);
}

Subterfuge.prototype.init = function() {
	this.adapter.init().then(() => {
		let url = 'dashboard';
		if (this.use_initial_hash) {
			let hash = this.utils.getHash();
			if (hash) url = hash;
		}
		this.route(url, "internal");
	});
}

Subterfuge.prototype.importTitle = function(url, title) {

	this.uri2title[ url ] = title;

	if (this.data_cache['form']) {
		if (this.data_cache['form']['href'] == url) {
			this.data_cache['form']['title'] = title;
		}
	}
	for (var i = 0; i < this.data_cache['history'].length; i++) {
		let entry = this.data_cache['history'][i];
		if (entry.href == url) entry.title = title;
	}
	for (var i = 0; i < this.data_cache['bookmarks'].length; i++) {
		let entry = this.data_cache['bookmarks'][i];
		if (entry.href == url) entry.title = title;
	}
}

Subterfuge.prototype.importData = function(data, url) {
	for (let k in data) this.data_cache[k] = data[k];

	// import all object titles

	if (data['title'] && url) {
		this.importTitle(url, data['title']);
	}
	if (data['form']) {
		var form = data['form'];
		this.importTitle(form.href, form.title);
	}
	if (data['list']) {
		for (var i = 0; i < data['list'].items.length; i++) {
			var item = data['list'].items[i];
			this.importTitle(item.href, item.title);
		}
	}
}


Subterfuge.prototype.redraw = function() {

	if (this.use_title) {
		document.title = this.title_prefix + this.data_cache['title'] + this.title_suffix;
	}

	ReactDOM.render(
		App(this.data_cache),
		this.react_root
	);
}

Subterfuge.prototype.route = function(url, internal, keepmsg, title) {
	if (!title) title = this.uri2title[ url ];
	if (!title) title = url;
	if (!internal) {
		this.historyPush(url, title)
	}

	this.data_cache['title'] = title;
	//this.last_route = url;

	if (!keepmsg)
	this.clearMessages();
	this.pushRQ();
	this.redraw();

	this.adapter.route(url).then((data) => {

		console.log("Routed",url,"got",data);

		this.importData(data, url);

		this.popRQ();
		this.redraw();

	}).catch((err) => {

		this.addMessage(''+err, 'error', err);

		console.log(err);

		this.popRQ();
		this.redraw();
	});
}
/*
Subterfuge.prototype.create = function() {

	var button = this.react_root.querySelector('button[data-action="create"]');
	var href = button.getAttribute('data-href');

	this.route(href);

}
*/

Subterfuge.prototype.preview = function() {
	var form = this.react_root.querySelector('form');
	var id = form.getAttribute('data-object-uri');
	var iname = this._last_input;
	if (!iname) return;
	var input = form.querySelector('[name="'+iname+'"]');
	if (!input) return;

	var url = id;
	var field = input.name;
	var value = input.value;

	if (!value) return;

	this.pushRQ();
	this.redraw();

	this.adapter.preview(url, field, value).then((html) => {

		if (!this.data_cache['form']) return;
		let form = this.data_cache['form'];
		if (form.href != url) return;

		for (var k in form.fields) {
			let fld = form.fields[k];
			if (fld.name == field) {
				fld.preview = html;
				break;
			}
		}

		this.popRQ();
		this.redraw();

	}).catch((err) => {

		console.log(err);

	});
}

Subterfuge.prototype.save = function() {

	var form = this.react_root.querySelector('form');
	var id = form.getAttribute('data-object-uri');
	var fd = new FormData(form)

	var cbs = form.querySelectorAll('input[type="checkbox"]:not(.starbox)');
	for (var i = 0; i < cbs.length; i++) {
		var cb = cbs[i];
		if (!cb.checked)
		fd.append(cb.name, cb.value);
	}

	this.clearMessages();
	this.pushRQ();
	this.redraw();

	this.adapter.save(id, fd).then((data) => {
		if (data['goto'] && this.checkRQ() < 2) {//one will be popped in a sec
			this.route(data['goto']);
		}

		this.addMessage("Saved", 'success');
		this.popRQ();
		this.redraw();

	}).catch((err) => {

		this.addMessage(''+err, 'error', err);
		this.popRQ();
		this.redraw();

		console.log(err);
	});
}

Subterfuge.prototype.del = function() {

	var form = this.react_root.querySelector('form');
	var uri = form.getAttribute('data-object-uri');

	this.clearMessages();
	this.pushRQ();
	this.redraw();

	this.adapter.del(uri).then((data) => {

		this.delBookmark(uri);

		if (data['goto'] && this.checkRQ() < 2) {//one will be popped in a sec
			this.route(data['goto'])
		}

		this.addMessage("Deleted", 'warning');
		this.popRQ();
		this.redraw();

	}).catch((err) => {

		this.addMessage(''+err, 'error', err);
		this.popRQ();
		this.redraw();	

		console.log(err);
	});

}

/* For adapters that don't support bulkdelete, use this: */
Subterfuge.prototype._bulkdeleteAuto = function(uris) {
	return Promise.all(
		uris.map((uri) => this.del(uri))
	);
}

Subterfuge.prototype.bulkdelete = function() {

	var form = this.react_root.querySelector('.stf-item-list .stf-list-contents');
	var checks = form.querySelectorAll('input[type="checkbox"]:not(.starbox)');

	var uris = [ ]

	for (var i = 0; i < checks.length; i++) {
		var checkbox = checks[i];
		if (checkbox.checked) {
			uris.push(checkbox.value);
		}
	}

	if (uris.length == 0) return;

	this.clearMessages();
	this.pushRQ();
	this.redraw();

	this.adapter.bulkdelete(uris).then((data) => {

		for (var i = 0; i < uris.length; i++) {
			this.delBookmark(uris[i]);
		}

		this.addMessage("Deleted", 'warning')
		this.popRQ();
		//this.redraw();

		this.historyGo(0, 'internal', true);

	}).catch((err) => {

		this.addMessage(''+err, 'error', err);
		this.popRQ();
		this.redraw();	

		console.log(err);
	});

}

Subterfuge.prototype.drop = function(event, ref) {
	//console.log(event, event.dataTransfer);
	var url = event.dataTransfer.getData('text/uri-list');
	if (!url) return;
	var links = this.react_root.querySelectorAll('.stf-bookmark-entry');
	for (var k in links) {
		var a = links[k];
		if (a.href == url) {
			event.target.value = '<img src="'+a.getAttribute('href')+'"/>';
			event.preventDefault();
			return false;
		}
	}
	return;
}

Subterfuge.prototype._filterRoute = function(url, params) {
	if (this.adapter.onFilter)
		url = this.adapter.onFilter(url, params);

	var pager = new Subterfuge_Page_Helper();
	pager.url_prefix = url;
	for (var k in params) {
		pager.addFilter(k, params[k]);
	}
	url = pager.fullURL();
	return url;
}

Subterfuge.prototype.filt = function() {

	var form = this.react_root.querySelector('.stf-item-list.stf-with-filters .stf-list-filters');
	var url = form.getAttribute('data-filter-base');
	var inps = form.querySelectorAll('input, select, textarea');
	var choice = { }
	for (var i = 0; i < inps.length; i++) {
		var inp = inps[i];
		choice[ inp.name ] = inp.value;
	}
	var btns = form.querySelectorAll('button[data-value]');
	for (var i = 0; i < btns.length; i++) {
		var btn = btns[i];
		var key = btn.getAttribute('data-name');
		var val = btn.getAttribute('data-value');
		if (btn.classList.contains('stf-active')) {
			choice[ key ] = val;
		}
	}

	if (this.data_cache['list'] && this.data_cache['list']['filters']) {
	for (var i = 0; i < this.data_cache['list']['filters'].length; i++) {
		var filter = this.data_cache['list']['filters'][i];
		var k = filter.name;
		if (choice[k] !== undefined)
			filter.value = choice[k];
	} }

	var rurl = this._filterRoute(url, choice);

	this.route(rurl);
}

Subterfuge.prototype.ui = function(cmd) {
	switch(cmd) {
		case 'sidebar.bookmarks':
			this.data_cache['side_tab'] = 'bookmarks'
		break;
		case 'sidebar.history':
			this.data_cache['side_tab'] = 'history'
		break;
	}
	this.redraw();
}

//class Subterfuge_Page_Helper
function Subterfuge_Page_Helper() {
	this.url_prefix = '';
	this.page_var = 'p';
	this.sort_key_var = 'sort_by';
	this.sort_dir_var = 'sort_dir';
	this.defaultSortDir = true; 
	this.filters = { }
	this.filterLabels = { }
	this.sorters = { }

	this.class_sort = [
		'asc',
		'active',
		'desc',
	];

	this.sortKey = '';
	this.sortDir = true; //false = asc | true = desc
	this.page = undefined;
	this.totalPages = 0;
	this.defaultPage = 1;
}
Subterfuge_Page_Helper.prototype.addFilter = function(name, value, title) {
	this.filters[name] = value;
	this.filterLabels[name] = title || Subterfuge_Utils.prototype.ucfirst(name);
}
Subterfuge_Page_Helper.prototype.addSorter = function(name, value) {
	this.sorters[name] = value;
}
Subterfuge_Page_Helper.prototype.setSort = function(name, dir) {
	this.sortKey = name
	this.sortDir = (dir.toLowerCase() == 'asc' || dir == -1 || dir == false) ? false : true;
}
Subterfuge_Page_Helper.prototype.setPrefix = function(p) {
	this.url_prefix = p
}
Subterfuge_Page_Helper.prototype.setPage = function(p) {
	this.page = p
}
Subterfuge_Page_Helper.prototype.setTotalPages = function(c) {
	this.totalPages = c;
}
Subterfuge_Page_Helper.prototype.setSlice = function(offset, limit, total) {
	let c_page = Math.floor(offset / limit) + 1;
	let n_pages = total / limit;

	this.totalPages = n_pages;
	this.page = c_page;
}
Subterfuge_Page_Helper.prototype.allParams = function(nofilters) {
	var params = { }
	if (!nofilters) for (var k in this.filters) {
		var v = this.filters[k];
		if (v)
			params[k] = v;
	}
	if (this.sortKey) {
		if (this.sort_key_var == this.sort_dir_var) {
			params[this.sort_key_var] = (this.sortDir ? '-' : '') + this.sortKey;	
		} else {
			params[this.sort_key_var] = this.sortKey;
			params[this.sort_dir_var] = this.sortDir ? 'desc' : 'asc';
		}
	}
	if (this.page != this.default_page)
		params[this.page_var] = this.page;
	return params;
}
Subterfuge_Page_Helper.prototype.fullURL = function() {
	return this.parametrized(this.allParams());
}
Subterfuge_Page_Helper.prototype.unfilteredURL = function() {
	return this.parametrized(this.allParams(1));
}
Subterfuge_Page_Helper.prototype.filterURL = function(name, value) {
	var params = this.allParams();
	params[name] = value;
	return this.parametrized(params);
}
Subterfuge_Page_Helper.prototype.sortClass = function(name) {
	let is_active = (this.sortKey == name) ? true : false;
	let dir = is_active ? (this.sortDir ? 1 : -1) : 0;
	return (is_active ? this.class_sort[1] : '')
		+ (dir ? ' ' + this.class_sort[dir + 1] : '');
}
Subterfuge_Page_Helper.prototype.sortURL = function(name) {
	var params = this.allParams();
	let already_active = this.sortKey == name ? true : false;
	let redir = already_active ? !this.sortDir : this.defaultSortDir;
	if (this.sort_key_var == this.sort_dir_var) {
		params[this.sort_key_var] = (redir ? '-' : '') + name;	
	} else {
		params[this.sort_key_var] = name;
		params[this.sort_dir_var] = redir ? 'desc' : 'asc';
	}
	return this.parametrized(params);
}
Subterfuge_Page_Helper.prototype.pageURL = function(p) {
	var params = this.allParams();
	params[this.page_var] = p;
	return this.parametrized(params);
}
Subterfuge_Page_Helper.prototype.pageClass = function(p) {
	return (this.page == p ? 'active' : '');
}
Subterfuge_Page_Helper.prototype.pagesArray = function() {
	let pages = [ ];
	for (var i = 1; i < this.totalPages + 1; i++) {
		pages.push({
			'label': i,
			'href': this.pageURL(i),
			'cls' : this.pageClass(i),
		});
	}
	return pages;
}
Subterfuge_Page_Helper.prototype.fullText = function(prefix) {
	let ret = prefix || '';
	for (var k in this.filters) {
		var t = this.filterLabels[k];
		var v = this.filters[k];
		if (v)
			ret += ' [' + t + ': ' + v + ']';
	}
	if (this.page) ret += ' p.' + this.page;
	return ret;
}

Subterfuge_Page_Helper.prototype.parametrized = function(params) {
	var url = this.url_prefix;
	var parts = [ ];
	for (var k in params) {
		var v = params[k];
		parts.push(k + '=' + v);
	}
	var d = '';
	if (url.indexOf('?') !== -1)
		d = (url.slice(-1) != '&' && url.slice(-1) != '?' ? '&' : '');
	else
		d = '?';
	return url + (parts.length ? d : '') + parts.join('\&');
}

Subterfuge_Page_Helper.prototype.consumeLinkHeader = function(linkhdr) {
	var info = this.parseLinkHeader(linkhdr);

	this.setPage(info[0]);
	this.setTotalPages(info[1]);
}
Subterfuge_Page_Helper.prototype.parseLinkHeader = function(linkhdr) {
	var pattern = /\<(.+?)\>; rel="(\w+?)"/g;
	var rels = { }; var match;
	while (match = pattern.exec(linkhdr)) {
  		rels[ match[2] ] = match[ 1 ];
	}
	//var base_url;
	var expr = new RegExp(this.page_var + '=(\\d+)');
	var numbers = { };
	for (var k in rels) {
		let url = rels[k];
		let i;
		let pmatch = url.match(expr);
		if (pmatch) {
			i = parseInt(pmatch[1]);
			//if (!base_url) base_url = url.replace(pmatch[0], '%%page%%');
		}
		numbers[ k ] = i;
	}
	var curr = 1;
	var last = 1;
	if (numbers['last']) last = numbers['last'];
	if (numbers['prev']) curr = numbers['prev'] + 1;
	if (curr > last && !rels['last']) last = curr;

	return [ curr, last ];//, base_url ];
}




//class Subterfuge_Noop_Adapter
function Subterfuge_Noop_Adapter(options, stf) {

	this.API_ROOT = options['root'];

	this.stf = stf;
	this.utils = stf ? stf.utils : new Subterfuge_Utils();
	this.transport = options['transport'] || axios;
	this.auth = options['auth'] || null;

	if (this.auth["username"]) {
		let username = this.auth.username || '';
		let password = this.auth.password || '';
		if (!(this.auth["headers"])) { this.auth["headers"] = { } }
		this.auth["headers"]['Authorization'] = "Basic " + btoa(username + ':' + password);
	}
	if (this.auth["headers"]) {
		Object.assign(this.transport.defaults, {'headers': this.auth.headers})
	}
}
Subterfuge_Noop_Adapter.prototype.init = function() {
	return Promise.resolve(true);
}
Subterfuge_Noop_Adapter.prototype.route = function(path) {

	let url = this.API_ROOT + path

	return this.transport.get(url).then((response) => {
		return response.data;
	});
}
Subterfuge_Noop_Adapter.prototype.save = function(id, fd) {

	let url = this.API_ROOT + id;

	return this.transport.post(url, fd).then((response) => {
		return response.data;
	})
}
Subterfuge_Noop_Adapter.prototype.del = function(id) {
/*
	let url = this.API_ROOT + 'delete';
	let fd = new FormData();
	fd.append('id', id);
*/
	let url = this.API_ROOT + id;
	let fd = new FormData();
	return this.transport.delete(url, fd).then((response) => {
		return response.data;
	});
}
Subterfuge_Noop_Adapter.prototype.bulkdelete = function(ids) {

	let url = this.API_ROOT + 'bulkdelete';
	let fd = new FormData();
	for (var i = 0; i < ids.length; i++) {
		fd.append('id[]', ids[i]);
	}

	return this.transport.post(url, fd).then((response) => {
		return response.data;
	});
}
Subterfuge_Noop_Adapter.prototype.preview = function(url, field, value) {
	return Promise.resolve(value);
}
