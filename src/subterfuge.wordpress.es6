function Subterfuge_Wordpress_Adapter(options, stf) {

	this.stf = stf;
	this.utils = stf ? stf.utils : new Subterfuge_Utils();
	this.transport = options['transport'] || axios;

	this.username = options['username'];
	this.password = options['password'];

	this.API_ENDPOINT = options['endpoint'] || (options['website'] + '/xmlrpc.php');

	this.post_cache = { }
}

Subterfuge_Wordpress_Adapter.prototype.init = function() {
	var types = this.request('wp.getPostTypes', [0])
		.then((response) => Promise.resolve(response.data[0]))
		.then((postypes) => this.convertPostTypes(postypes));
	var statuses = this.request('wp.getPostStatusList', [0])
		.then((response) => Promise.resolve(response.data[0]))
		.then((statuslist) => this.convertStatusList(statuslist));
	
	return Promise.all([ types, statuses ]);
}

Subterfuge_Wordpress_Adapter.prototype.convertStatusList = function(statuslist) {
	this.status_list = statuslist;
	
	var statusOptions = [ ];
	for (var k in statuslist) {
		var v = statuslist[k];
		statusOptions.push({
			'value': k, 'label': v,
		});
	}
	/* This is stupid, but it only happens once, during init, so: */
	for (var i = 0; i < this.wpPostFields.length; i++) {
		var head = this.wpPostFields[i]
		if (head._name == 'status') {
			head.options = statusOptions;
			break;
		}
	}
	for (var i = 0; i < this.wpPostFilters.length; i++) {
		var filt = this.wpPostFilters[i]
		if (filt.name == 'post_status') {
			filt.options = statusOptions;
			break;
		}
	}	
	for (var i = 0; i < this.wpMediaFields.length; i++) {
		var head = this.wpMediaFields[i]
		if (head._name == '_status') {
			head.options = statusOptions;
			break;
		}
	}

}

Subterfuge_Wordpress_Adapter.prototype.convertPostTypes = function(postypes) {
	this.post_types = postypes;
	var mitems = [ ];
	for (var name in postypes) {
		var ptype = postypes[name];
		mitems.push({
			'name': name,
			'label': ptype.labels.menu_name,
			'href': (name == 'attachment') 
				? name
				: 'posts?post_type=' + name,
		})
	}
	//console.log("Saved menu", mitems);
	this.saved_menu = mitems;
}

Subterfuge_Wordpress_Adapter.prototype.route = function(url) {

	var params = this.utils.getSearchParams(url);

	url = this.utils.getLocation(url);

	var parts = url.split(/\//);

	if (url == 'dashboard') {

		return Promise.resolve(this.menu());

	}

	if (parts[0] == 'attachment' && !parts[1]) {

		return this.listMedia(params);

	}

	if (parts[0] == 'posts' && !parts[1]) {

		return this.listPosts(params);

	}

	if ((parts[0] == 'posts' || parts[0] == 'attachment') && parts[1]) {

		if (parts[1] == "0") {
			let post = this.emptyPost(params);
			return Promise.resolve(this.convertPost(post));
		}

		return this.wp_getPost(parts[1]).then((r) => this.convertPost(r.data[0]));
	}

	return Promise.reject(new Error('Unrecognized url ' + url))
}


Subterfuge_Wordpress_Adapter.prototype.save = function(url, fd) {
	var params = this.utils.getSearchParams(url);
	url = this.utils.getLocation(url);

	var parts = url.split(/\//);
	var id = parseInt(parts[1]);

	if (parts[0] == 'posts' || parts[0] == 'attachment') {
		if (!id) fd.append('post_type', params['post_type']);
		if (fd.get('@data')) {
			return this.uploadFile(0, fd.get('@data'));
		}
		return this.savePost(id, fd);
	}

	return Promise.reject(new Error('Unrecognized url ' + url))
}

Subterfuge_Wordpress_Adapter.prototype.del = function(url) {

	var parts = url.split(/\//);
	var id = parts[1];

	if (parts[0] == 'posts' || parts[0] == 'attachment')
		return this.deletePost(id);

	return Promise.reject(new Error('Unrecognized url ' + url))
}

Subterfuge_Wordpress_Adapter.prototype.bulkdelete = function(ids) {

	var need = [ ];
	for (var i = 0; i < ids.length; i++) {
		need.push( this.del(ids[i]) );
	}

	return Promise.all(need).then((r) => {
		
	});

}

Subterfuge_Wordpress_Adapter.prototype.onFilter = function(url, params) {
	return url;
}


Subterfuge_Wordpress_Adapter.prototype.request = function(method, params, noauth) {
	let url = this.API_ENDPOINT;
	params = params || [ ];

	if (!noauth) {
		params.push(this.username);
		params.push(this.password);
	}

	var xmlDoc = XMLRPC.document(method, params);
	var xmlStr = new XMLSerializer().serializeToString(xmlDoc.documentElement);

	return this.transport({
		'method': 'POST',
		'url': url,
		'data': xmlStr,
	}).then((response) => {
		response.data = XMLRPC.fromXMLRPC(response.data);
		if (response.data.code)
			return Promise.reject(new Error(response.data.message));
		return Promise.resolve(response);
	});

}

Subterfuge_Wordpress_Adapter.prototype.savePost = function(id, iFD) {

	id = parseInt(id);

	//var post = this.post_cache[id];

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
			'goto': 'posts/' + response.data[0]
			});
		}
		return Promise.resolve(response['data']);
	});
}

Subterfuge_Wordpress_Adapter.prototype.deletePost = function(id) {

	id = parseInt(id);

	var post = this.post_cache[id];

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
				'goto': 
					(post && post.post_type == 'attachment')
					? 'attachment'
					: 'posts?post_type=' + (post ? post.post_type : ''),
			});
		}
		return Promise.resolve(response['data']);
	});
}

Subterfuge_Wordpress_Adapter.prototype.uploadFile = function(post_id, file) {
	return this.utils.readFileAs(file, 'ArrayBuffer')
	 .then((contentsAB) => {
		var data = {
			'name': file.name,
			'type': file.type,
			'bits': contentsAB, //xml-rpc will base64-encode this
			'overwrite': false,
		}
		post_id = parseInt(post_id);
		if (post_id) data['post_id'] = post_id;
		var params = [
			0, //blogid
			this.username,
			this.password,
			data,
		]
		return this.request('wp.uploadFile', params, 1);
	})
	 .then((response) => {
		//hack -- simulate redirect for new objects
		if (response.data[0]) {
			return Promise.resolve({
			'goto': 'attachment/' + response.data[0]['attachment_id']
			});
		}
		return Promise.resolve(response['data']);
	});
}

Subterfuge_Wordpress_Adapter.prototype.menu = function() {
	return {
		'menu': this.saved_menu,
	}
}

Subterfuge_Wordpress_Adapter.prototype.listMedia = function(options) {
	var filter = { 
	
	}
	var reuse = [ 'number', 'offset', 'parent_id', 'mime_type' ];
	for (var k in reuse) {
		var key = reuse[k];
		if (options[key]) filter[key] = options[key];
	}
	var args = [
		0,
		this.username,
		this.password,
		filter
	]

	return this.request('wp.getMediaLibrary', args, 1).then((r) => 
		this.convertMedia(r.data[0], options, filter)
	);

}

Subterfuge_Wordpress_Adapter.prototype.listPosts = function(options) {
	var filter = { 
	
	}
	var reuse = [ 'post_type', 'post_status', 'number', 'offset', 'orderby', 'order' ];
	for (var k in reuse) {
		var key = reuse[k];
		if (options[key]) filter[key] = options[key];
	}
	var args = [
		0,
		this.username,
		this.password,
		filter
	]
	//var method = 'wp.getPosts';
	//if (options['post_type'] == 'attachment') method = 'wp.getMediaLibrary';
	return this.request('wp.getPosts', args, 1).then((r) => 
		this.convertPosts(r.data[0], options, filter)
	);

}
Subterfuge_Wordpress_Adapter.prototype.wp_getPosts = function(params) {
	return this.request('wp.getPosts', [0]);
}

Subterfuge_Wordpress_Adapter.prototype.wp_getPost = function(id) {
	return this.request('wp.getPost', [0, this.username, this.password, parseInt(id)], 1);
}

Subterfuge_Wordpress_Adapter.prototype.wpMenu = [
	{ 'name' : 'posts', 'title': 'Posts', 'href' : 'posts' }, 
];

Subterfuge_Wordpress_Adapter.prototype.wpPostFields = [ 
	{ '_name': 'title', 'label': 'Title', 'type': 'title', '_sp': 'title', },
	{ '_name': 'content', 'label': 'Content', 'type': 'textarea', '_sp': 'editor' },
	{ '_name': 'excerpt', 'label': 'Excerpt', 'type': 'textarea', '_sp': 'excerpt' },
	{ '_name': 'status', 'label': 'Status', 'type': 'select',
		'options': [ /* <- replace this with getStatusList results */
			{ 'value': 'draft',   'label': 'Draft' },
			{ 'value': 'publish', 'label': 'Published' },
		]},
];

Subterfuge_Wordpress_Adapter.prototype.wpPostHeaders = [ 
	{ 'name': 'id', 'label': 'ID' },
	{ 'name': 'name', 'label': 'Name', },
	{ 'name': 'title', 'label': 'Title' },
	{ 'name': 'status', 'label': 'Status' },
];

Subterfuge_Wordpress_Adapter.prototype.wpPostFilters = [ 
	{ 'name': 'post_type', 'label': 'Type' },
	{ 'name': 'post_status', 'label': '', 'type': 'toggle',
		'options': [/* <- replace this with getStatusList results */
			{ 'value': 'publish', 'label': 'Published' },
			{ 'value': 'draft', 'label': 'Draft' },
		]
	},
];

Subterfuge_Wordpress_Adapter.prototype.emptyPost = function(options) {
	var pname = options['post_type'] || 'post';
	var ptype = this.post_types[pname];
	var post = { };
	post['post_id'] = 0;
	post['post_type'] = pname;
	for (var k = 0; k < this.wpPostFields.length; k++) {
		var wpField = this.wpPostFields[k];
		if (wpField._sp && !ptype.supports[wpField._sp]) continue;
		post[ 'post_' + wpField._name ] = '';
	}
	//console.log(post);
	return post;
}

Subterfuge_Wordpress_Adapter.prototype.convertPosts = function(posts, options) {

	var pager = new Subterfuge_Page_Helper();

	pager.setPrefix('posts?');
	pager.sort_key_var = 'orderby';
	pager.sort_dir_var = 'order';

	if (options['orderby']) {
		pager.addSorter(options['orderby'], options['order']);
		pager.setSort(options['orderby'], options['order']);
	}

	var filters = [ ];
	var headers = [ ];
	var items = [ ];

	for (var i = 0; i < this.wpPostFilters.length; i++) {
		var filt = this.wpPostFilters[i];
		filt.value = options[filt.name] || '';
		//filters.push(filt);

		pager.addFilter(filt.name, filt.value, filt.label);
	}
	for (var i = 0; i < this.wpPostHeaders.length; i++) {
		var head = this.wpPostHeaders[i];
		head['href'] = pager.sortURL(head.name);
		head['cls'] = pager.sortClass(head.name);
		//headers.push(head);
	}


	for (var i = 0; i < posts.length; i++) {
		var post = posts[i];
		//console.log(i,post);
		var columns = [ ];
		for (var k = 0; k < this.wpPostHeaders.length; k++) {
			var head = this.wpPostHeaders[k];
			var name = 'post_' + head['name'];
			//console.log(name, post[name], head);
			columns.push(post[ name ]);
		}
		items.push({
			'href': 'posts/' + post.post_id,
			'title': post.post_title ? post.post_title : 'Post ' + post.post_id,
			'columns': columns,
		});
	}

	return {
		'title': pager.fullText('Posts'),
		'list': {
			'filters': this.wpPostFilters,//filters,
			'headers': this.wpPostHeaders,
			'items': items,
			'pages': pager.pagesArray(),			
			'create_href': 'posts/' + 0 + '?post_type=' + options['post_type'],
			'filter_href': pager.unfilteredURL(),
		},
		'form': null,
		'menu': this.saved_menu,
		'menu_active': options['post_type'],
	}
}

Subterfuge_Wordpress_Adapter.prototype.convertPost = function(post) {

	//console.log(post);
	/* Since we don't pass all the values into the form,
		it's useful to keep some */
	this.post_cache[ post.post_id ] = post;

	var ptype = this.post_types[post.post_type];

	var fields = [ ];
	for (var i = 0; i < this.wpPostFields.length; i++) {
		var wpField = this.wpPostFields[i];
		if (wpField._sp && !ptype.supports[wpField._sp]) continue;
		var name = 'post_' + wpField['_name'];
		fields.push({
			'name' : name,
			'label': wpField['label'],
			'type' : wpField['type'],
			'value': post[ name ],
			'preview': this._convertHTML(name, post[ name ]),
			'options': wpField['options'],
		//	'group': 'main',
		});
	}
	if (post.post_type == 'attachment') {
		if (post.post_mime_type &&
		post.post_mime_type.split('/')[0] == 'image') {
			fields.push({
				'name' : '@image',
				'label': 'Preview',
				'type' : 'imagepreview',
				'value': post[ 'guid' ],
		}); }
		fields.push({
			'name' : '@data',
			'label': 'File',
			'type' : 'file',
			'value': '',
		});
	}
	return {
		'form': {
			'href': (post.post_type == 'attachment' ? 'attachment' : 'posts')
					+ '/' + post.post_id + (!post.post_id ? '?post_type=' + post.post_type:''), 
			'title': (!post.post_id ? 'new ' + ptype.labels.singular_name : post.post_title),
			'fields': fields,
			//'groups': [
			//	{ 'label': 'Main', 'name': 'main' },
			//]
			'autofocus_field': 'post_content',
		},
		'list': null,
		'menu': this.saved_menu,
		'menu_active': post.post_type,
	};
}

Subterfuge_Wordpress_Adapter.prototype.wpMediaFields = [ 
	{ '_name': 'title', 'label': 'Title', 'type': 'title', '_sp': 'title', },
	{ '_name': 'content', 'label': 'Content', 'type': 'textarea', '_sp': 'editor' },
	{ '_name': 'excerpt', 'label': 'Excerpt', 'type': 'textarea', '_sp': 'excerpt' },
	{ '_name': 'status', 'label': 'Status', 'type': 'select',
		'options': [ /* <- replace this with getStatusList results */ 
			{ 'value': 'draft',   'label': 'Draft' },
			{ 'value': 'publish', 'label': 'Published' },
		]},
];

Subterfuge_Wordpress_Adapter.prototype.wpMediaHeaders = [ 
	{ 'name': 'id', 'label': 'ID', 'cls':'','href':null },
	{ 'name': 'parent', 'label': 'PID', 'cls':'','href':null },
	{ 'name': 'link', 'label': 'Link', 'cls':'','href':null },
	{ 'name': 'title', 'label': 'Title', 'cls':'','href':null },
	{ 'name': 'datetime', 'label': 'Time', 'cls':'','href':null },
	{ 'name': '', 'label': 'Type', 'cls':'','href':null },
];

Subterfuge_Wordpress_Adapter.prototype.wpMediaFilters = [ 
	{ 'name': 'mime_type', 'label': 'Mimetype' },
];

Subterfuge_Wordpress_Adapter.prototype.convertMedia = function(files, options) {

	var pager = new Subterfuge_Page_Helper();

	pager.setPrefix('attachment?');

	var items = [ ];

	for (var i = 0; i < this.wpMediaFilters.length; i++) {
		var filt = this.wpMediaFilters[i];
		filt.value = options[filt.name] || '';
		pager.addFilter(filt.name, filt.value, filt.label);
	}

	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		//console.log(i,file);
		var columns = [ ];
		for (var k = 0; k < this.wpMediaHeaders.length; k++) {
			var head = this.wpMediaHeaders[k];
			if (!head.name) continue;
			columns.push(file[ head.name ]);
		}
		columns.push(file[ 'metadata' ][' file ']);
		items.push({
			'href': 'attachment/' + file.attachment_id,
			'title': file.title ? file.title : 'Attachment ' + file.attachment_id,
			'columns': columns,
		});
	}

	return {
		'title': pager.fullText('Media'),
		'list': {
			'filters': this.wpMediaFilters,
			'headers': this.wpMediaHeaders,
			'items': items,
			'pages': pager.pagesArray(),		
			'create_href': 'attachment/' + 0 + '?post_type=attachment',
			'filter_href': pager.unfilteredURL(),
		},
		'form': null,
		'menu': this.saved_menu,
		'menu_active': 'attachment',
	}
}

Subterfuge_Wordpress_Adapter.prototype._convertHTML = function(field, value) {
	if (field == 'post_content' || field == 'post_excerpt') {
		var html = value.replace(/\n/g, '<br/>');
		return html + ' ';
	}
	return '';
	//return value;
}

Subterfuge_Wordpress_Adapter.prototype.preview = function(url, field, value) {
	return Promise.resolve(this._convertHTML(field, value));
}
