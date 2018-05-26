function Subterfuge_Github_Adapter(options, stf) {

	this.stf = stf;
	this.utils = stf ? stf.utils : new Subterfuge_Utils();
	this.transport = options['transport'] || axios;

	//this.username = options['username'];
	//this.password = options['password'];
	
	this.repository = options['repository'];	

	this.API_ENDPOINT = options['endpoint'] || 'https://api.github.com';

	this.issue_cache = { }
}

Subterfuge_Github_Adapter.prototype.init = function() {
	var labels = this.gh_getLabels()
		.then((response) => response.data)
		.then((labelslist) => this.convertLabelsList(labelslist));

	this.createFakeMenu();

	return Promise.all([ labels ]);
}

Subterfuge_Github_Adapter.prototype.convertLabelsList = function(labelslist) {
	this.labels_list = labelslist;

	var labelOptions = [ ];
	for (var k in labelslist) {
		var label = labelslist[k];
		labelOptions.push({
			'value': label.name, 'label': label.name,
			'__source': label,
		});
	}

	/* This is stupid, but it only happens once, during init, so: */
	for (var i = 0; i < this.ghIssueFields.length; i++) {
		var head = this.ghIssueFields[i]
		if (head.name == 'labels') {
			head.options = labelOptions;
			break;
		}
	}
	for (var i = 0; i < this.ghIssueFilters.length; i++) {
		var filt = this.ghIssueFilters[i]
		if (filt.name == 'labels') {
			filt.options = labelOptions;
			break;
		}
	}

}

Subterfuge_Github_Adapter.prototype.createFakeMenu = function() {
	this.saved_menu = this.ghMenu;
}

Subterfuge_Github_Adapter.prototype.route = function(url) {

	var params = this.utils.getSearchParams(url);

	url = this.utils.getLocation(url);

	var parts = url.split(/\//);

	if (url == 'dashboard') {

		return Promise.resolve(this.menu());

	}

	if (parts[0] == 'issues' && !parts[1]) {

		return this.listIssues(params);

	}

	if (parts[0] == 'issues' && parts[1]) {

		if (parts[1] == "0") {
			let issue = this.emptyIssue(params);
			return Promise.resolve(this.convertIssue(issue));
		}

		return this.gh_getIssue(parts[1]).then((r) => this.convertIssue(r.data));
	}

	if (parts[0] == 'prs' && !parts[1]) {

		return this.listPrs(params);

	}

	if (parts[0] == 'prs' && parts[1]) {

		return this.gh_getPull(parts[1]).then((r) => this.convertPr(r.data));

	}

	return Promise.reject(new Error('Unrecognized url ' + url))
}


Subterfuge_Github_Adapter.prototype.save = function(url, fd) {
	var params = this.utils.getSearchParams(url);
	url = this.utils.getLocation(url);

	var parts = url.split(/\//);
	var id = parseInt(parts[1]);

	if (parts[0] == 'issues')
		return this.saveIssue(id, fd);

	if (parts[0] == 'prs')
		return this.savePr(id, fd);

	return Promise.reject(new Error('Unrecognized url ' + url))
}

Subterfuge_Github_Adapter.prototype.preview = function(url, field, value) {

	if (field == 'body') {
		return this.gh_getMarkdown(value).then((r) => r.data);
	}

	return Promise.resolve(value);
}


Subterfuge_Github_Adapter.prototype.del = function(url) {

	var parts = url.split(/\//);
	var id = parts[1];

	if (parts[0] == 'issues')
		return this.deleteIssue(id);

	if (parts[0] == 'prs')
		return this.deletePr(id);

	return Promise.reject(new Error('Unrecognized url ' + url))
}

Subterfuge_Github_Adapter.prototype.bulkdelete = function(ids) {

	var need = [ ];
	for (var i = 0; i < ids.length; i++) {
		need.push( this.del(ids[i]) );
	}

	return Promise.all(need).then((r) => {
		
	});
}

Subterfuge_Github_Adapter.prototype.onFilter = function(url, params) {
	return url;
}


Subterfuge_Github_Adapter.prototype.request = function(url, params, method) {
	params = params || { };
	method = method || 'GET';

	//if (!noauth) {
	//	params.push(this.username);
	//	params.push(this.password);
	//}

	let post_params = method != 'GET';

		


	return this.transport({
		'method': method,
		'url': url,
		'params': !post_params ? params : undefined,
		'data': post_params ? params : undefined,
	}).then((response) => {
		if (response.data.code)
			return Promise.reject(new Error(response.data.message));
		return Promise.resolve(response);
	});

}

Subterfuge_Github_Adapter.prototype.saveIssue = function(id, iFD) {

	id = parseInt(id);

	//var issue = this.issue_cache[id];

	var content = { }

	for(var pair of iFD.entries()) {
		content[ pair[0] ] = pair[1];
	}

	var method = id ? 'wp.editPost' : 'wp.newPost';
	var params = id ? [
		0, //blog id
		this.username,
		this.password,
		id,
		content,
	] : [
		0,
		this.username,
		this.password,
		content,
	]
	return this.request(method, params, 1).then((response) => {
		//hack -- simulate redirect for new objects

		//NOTICE:
		//we receive response,
		//but only pass down the data from it (IN SOME CASES)
		//this is crazily incosistent and wrong
		if (!id && response.data[0]) {
			return Promise.resolve({
			'goto': 'issues/' + response.data[0]
			});
		}
		return Promise.resolve(response['data']);
	});
}

Subterfuge_Github_Adapter.prototype.deleteIssue = function(id) {

	id = parseInt(id);

	var post = this.issue_cache[id];

	var params = [
		0, //blog id
		this.username,
		this.password,
		id,
	];
	return this.request('wp.deletePost', params, 1).then((response) => {
		//hack -- simulate redirect for new objects

		//NOTICE:
		//we receive response,
		//but only pass down the data from it (IN SOME CASES)
		//this is crazily incosistent and wrong
		if (response.data[0]) {
			return Promise.resolve({
				'goto': 'posts?post_type=' + (post ? issue.post_type : ''),
			});
		}
		return Promise.resolve(response['data']);
	});
}

Subterfuge_Github_Adapter.prototype.menu = function() {
	return {
		'menu': this.saved_menu,
	}
}

Subterfuge_Github_Adapter.prototype.listIssues = function(options) {

	return this.gh_getIssues(options)
		.then((r) => this.convertIssues(r.data, r.headers['link'], options));

}

Subterfuge_Github_Adapter.prototype.listPrs = function(options) {

	return this.gh_getPulls(options)
		.then((r) => this.convertPrs(r.data, r.headers['link'], options));

}


Subterfuge_Github_Adapter.prototype.gh_getLabels = function() {
	var url = [ this.API_ENDPOINT,
		'repos', this.repository, 'labels'].join('/');
	return this.request(url, { });
}

Subterfuge_Github_Adapter.prototype.gh_getMarkdown = function(md) {
	var url = [ this.API_ENDPOINT, 'markdown' ].join('/');
	var params = {
		'text': md,
		'mode': 'gfm',
		'context': this.repository,
	}
	return this.request(url, params, 'POST');
}

Subterfuge_Github_Adapter.prototype.gh_getIssues = function(params) {
	var url = [ this.API_ENDPOINT,
		'repos', this.repository, 'issues'].join('/');
	return this.request(url, params);
}

Subterfuge_Github_Adapter.prototype.gh_getIssue = function(id) {
	var url = [ this.API_ENDPOINT, 
		'repos', this.repository, 'issues', id].join('/');
	return this.request(url, { });
}

Subterfuge_Github_Adapter.prototype.gh_getPulls = function(params) {
	var url = [ this.API_ENDPOINT,
		'repos', this.repository, 'pulls'].join('/');
	return this.request(url, params);
}

Subterfuge_Github_Adapter.prototype.gh_getPull = function(id) {
	var url = [ this.API_ENDPOINT, 
		'repos', this.repository, 'pulls', id].join('/');
	return this.request(url, { });
}

Subterfuge_Github_Adapter.prototype.ghMenu = [
	{ 'name' : 'issues', 'label': 'Issues', 'href' : 'issues' },
	{ 'name' : 'prs', 'label': 'Pull Requests', 'href' : 'prs' }, 
];

Subterfuge_Github_Adapter.prototype.ghIssueFields = [ 
	{ 'name': 'title', 'label': 'Title', 'type': 'title' },
	{ 'name': 'body', 'label': 'Body', 'type': 'textarea' },
	{ 'name': 'state', 'label': 'State', 'type': 'select',
		'options': [
			{ 'value': 'open',   'label': 'Open' },
			{ 'value': 'closed', 'label': 'Closed' },
		]},
	{ 'name': 'labels', 'label': 'Labels', 'type': 'select',
		'options': [ /* <- replace this with getLabels results */

		],
		'multiple': true},
];

Subterfuge_Github_Adapter.prototype.ghIssueHeaders = [ 
	{ 'name': 'number', 'label': 'Number', 'href':null, 'cls':'' },
	//{ 'name': 'created_at', 'label': 'Created', 'sort': 'created'},
	//{ 'name': 'updated_at', 'label': 'Updated', 'sort': 'updated'},
	{ 'name': 'comments', 'label': 'Comments' , 'sort': 'comments'},
	{ 'name': 'state', 'label': 'State', 'href':null, 'cls':'' },
];

Subterfuge_Github_Adapter.prototype.ghIssueFilters = [
	{ 'name': 'creator', 'label': 'Author', 'type': 'text' }, 
	{ 'name': 'state', 'label': 'State', 'type': 'toggle',
		'options': [
			{ 'value': 'open', 'label': 'Open' },
			{ 'value': 'closed', 'label': 'Closed' },
		]
	},
	{ 'name': 'labels', 'label': 'Labels', 'type': 'select',
		'options': [ /* <- replace this with getLabels results */

		]
	},
];



Subterfuge_Github_Adapter.prototype.ghPrFilters = [
	{ 'name': 'base', 'label': 'Branch', 'type': 'text' }, 
	{ 'name': 'state', 'label': 'State', 'type': 'toggle',
		'options': [
			{ 'value': 'open', 'label': 'Open' },
			{ 'value': 'closed', 'label': 'Closed' },
		]
	},
];

Subterfuge_Github_Adapter.prototype.ghPrHeaders = [ 
	{ 'name': 'number', 'label': 'Number', 'href':null, 'cls':'' },
	//{ 'name': 'created_at', 'label': 'Created', 'sort': 'created'},
	//{ 'name': 'updated_at', 'label': 'Updated', 'sort': 'updated'},
	{ 'name': 'comments', 'label': 'Comments' , 'sort': 'popularity'},
	{ 'name': 'state', 'label': 'State', 'href':null, 'cls':'' },
];

Subterfuge_Github_Adapter.prototype.ghPrFields = [ 
	{ 'name': 'title', 'label': 'Title', 'type': 'title' },
	{ 'name': 'body', 'label': 'Body', 'type': 'textarea' },
	{ 'name': 'state', 'label': 'State', 'type': 'select',
		'options': [
			{ 'value': 'open',   'label': 'Open' },
			{ 'value': 'closed', 'label': 'Closed' },
		]},
];


Subterfuge_Github_Adapter.prototype.emptyIssue = function(options) {
	var issue = { };
	issue['id'] = 0;
	for (var k = 0; k < this.ghIssueFields.length; k++) {
		var f = this.ghIssueFields[k];
		issue[ f.name ] = '';
	}
	return issue;
}

Subterfuge_Github_Adapter.prototype.convertIssues = function(issues, linkhdr, options) {
	var pager = new Subterfuge_Page_Helper();

	pager.page_var = 'page';
	pager.consumeLinkHeader(linkhdr);

	pager.setPrefix('issues?');
	pager.sort_key_var = 'sort';
	pager.sort_dir_var = 'direction';

	if (options['sort']) {
		pager.addSorter(options['sort'], options['direction']);
		pager.setSort(options['sort'], options['direction']);
	}

	for (var i = 0; i < this.ghIssueFilters.length; i++) {
		var filt = this.ghIssueFilters[i];
		filt.value = options[filt.name] || '';
		pager.addFilter(filt.name, filt.value, filt.label);
	}
	for (var i = 0; i < this.ghIssueHeaders.length; i++) {
		var head = this.ghIssueHeaders[i];
		if (head.sort) {
			head['href'] = pager.sortURL(head.sort);
			head['cls'] = pager.sortClass(head.sort);
		}
	}

	var items = [ ];
	for (var i = 0; i < issues.length; i++) {
		var issue = issues[i];
		var columns = [ ];
		for (var k = 0; k < this.ghIssueHeaders.length; k++) {
			var head = this.ghIssueHeaders[k];
			columns.push(issue[ head.name ]);
		}
		items.push({
			'href': 'issues/' + issue.number,
			'title': issue.title ? issue.title : 'Issue ' + issue.number,
			'columns': columns,
		});
	}
	return {
		'title': pager.fullText('Issues'),
		'list': {
			'filters': this.ghIssueFilters,
			'headers': this.ghIssueHeaders,
			'items': items,
			'pages': pager.pagesArray(),			
			'create_href': 'issues/' + 0,
			'filter_href': pager.unfilteredURL(),
		},
		'form': null,
		'menu': this.saved_menu,
		'menu_active': 'issues',
	}
}

Subterfuge_Github_Adapter.prototype.convertIssue = function(issue) {

	/* Since we don't pass all the values into the form,
		it's useful to keep some */
	this.issue_cache[ issue.id ] = issue;

	var fields = [ ];
	for (var i = 0; i < this.ghIssueFields.length; i++) {
		var ghField = this.ghIssueFields[i];
		var val = issue[ ghField['name'] ];
		if (ghField['name'] == 'labels') {
			var arr = [ ];
			for (var k = 0; k < val.length; k++) {
				arr.push(val[k].name);
			}
			val = arr;
		}
		fields.push({
			'name' : ghField['name'],
			'label': ghField['label'],
			'type' : ghField['type'],
			'value': val,
			'preview': (ghField['name'] == 'body' ? ' ' : ''),
			'options': ghField['options'],
			'multiple': ghField['multiple'],
		//	'group': 'main',
		});
	}

	return {
		'form': {
			'href': 'issues/' + issue.number, 
			'title': (!issue.id ? 'new Issue' : issue.title),
			'fields': fields,
			//'groups': [
			//	{ 'label': 'Main', 'name': 'main' },
			//]
		},
		'list': null,
		'menu': this.saved_menu,
		'menu_active': 'issues',
	};
}

Subterfuge_Github_Adapter.prototype.convertPrs = function(issues, linkhdr, options) {
	var pager = new Subterfuge_Page_Helper();

	pager.page_var = 'page';
	pager.consumeLinkHeader(linkhdr);

	pager.setPrefix('prs?');
	pager.sort_key_var = 'sort';
	pager.sort_dir_var = 'direction';

	if (options['sort']) {
		pager.addSorter(options['sort'], options['direction']);
		pager.setSort(options['sort'], options['direction']);
	}

	for (var i = 0; i < this.ghPrFilters.length; i++) {
		var filt = this.ghPrFilters[i];
		filt.value = options[filt.name] || '';
		pager.addFilter(filt.name, filt.value, filt.label);
	}
	for (var i = 0; i < this.ghPrHeaders.length; i++) {
		var head = this.ghPrHeaders[i];
		if (head.sort) {
			head['href'] = pager.sortURL(head.sort);
			head['cls'] = pager.sortClass(head.sort);
		}
	}

	var items = [ ];

	for (var i = 0; i < issues.length; i++) {
		var issue = issues[i];
		var columns = [ ];
		for (var k = 0; k < this.ghPrHeaders.length; k++) {
			var head = this.ghPrHeaders[k];
			columns.push(issue[ head.name ]);
		}
		items.push({
			'href': 'prs/' + issue.number,
			'title': issue.title ? issue.title : 'PR ' + issue.number,
			'columns': columns,
		});
	}
	return {
		'title': pager.fullText('PRs'),
		'list': {
			'filters': this.ghPrFilters,
			'headers': this.ghPrHeaders,
			'items': items,
			'pages': pager.pagesArray(),			
			'create_href': null,
			'filter_href': pager.unfilteredURL(),
		},
		'form': null,
		'menu': this.saved_menu,
		'menu_active': 'prs',
	}
}

Subterfuge_Github_Adapter.prototype.convertPr = function(issue) {
	/* Since we don't pass all the values into the form,
		it's useful to keep some */
	this.issue_cache[ issue.id ] = issue;

	var fields = [ ];
	for (var i = 0; i < this.ghPrFields.length; i++) {
		var ghField = this.ghPrFields[i];
		var val = issue[ ghField['name'] ];
		fields.push({
			'name' : ghField['name'],
			'label': ghField['label'],
			'type' : ghField['type'],
			'value': val,
			'preview': (ghField['name'] == 'body' ? ' ' : ''),
			'options': ghField['options'],
		//	'group': 'main',
		});
	}

	return {
		'form': {
			'href': 'prs/' + issue.number, 
			'title': issue.title,
			'fields': fields,
			//'groups': [
			//	{ 'label': 'Main', 'name': 'main' },
			//]
		},
		'list': null,
		'menu': this.saved_menu,
		'menu_active': 'prs',
	};
}
