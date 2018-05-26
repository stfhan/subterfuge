function Subterfuge_Pimcore_Adapter(options, stf) {

	this.stf = stf;
	this.utils = stf ? stf.utils : new Subterfuge_Utils();
	this.transport = options['transport'] || axios;

	let website = options['website'];
	let apikey = options['apikey'];

	this.API_ROOT = website + '/webservice/rest/';
	this.API_KEY = apikey;

	this.class_map = { }
	this.class_info = { }
	this.class_name2id = { }
	this.class_id2name = { }

	this.object_cache = { }
	this.asset_cache = { }
	this.document_cache = { }

	this.saved_menu = [ ]
}

Subterfuge_Pimcore_Adapter.prototype.init = function() {
	return this.listAllClasses()
	.then((d) => this.readClassList(d))
	.then((_) => this.convertClassList(this.class_id2name));
}

Subterfuge_Pimcore_Adapter.prototype.route = function(url) {

	var params = this.utils.getSearchParams(url);

	url = this.utils.getLocation(url);

	var parts = url.split(/\//);

	if (url == 'dashboard') {

		let len = Object.keys(this.class_id2name).length;

		if (!len) {
			return this.init();
		}
		else {
			return Promise.resolve(this.convertClassList(this.class_id2name))
		}
	}

	if (parts[0] == 'objects' && !parts[2]) {
	
		var className = parts[1]

		return this.listObjects(className, params);
	}

	if (parts[0] == 'objects' && parts[2]) {

		var className = parts[1];
		var id = parts[2];

		if (id == 0) {
			let obj = this.emptyObject(className);
			return Promise.resolve(this.convertSingleObject({ 'data': obj }, className ));
		}

		return this.getObject(id).then((data) => this.convertSingleObject(data, className));
	}

	if (parts[0] == 'assets' && !parts[1]) {
		return this.listAssets(params);
	}

	if (parts[0] == 'assets' && parts[1]) {

		var id = parts[1];

		if (id == 0) {
			let obj = this.emptyAsset();
			return Promise.resolve(this.convertSingleAsset({'data': { 'data': obj } }));
		}

		return this.getAsset(id).then((data) => this.convertSingleAsset(data));
	}

	if (parts[0] == 'documents' && !parts[1]) {
		return this.listDocuments(params);
	}
	if (parts[0] == 'documents' && parts[1]) {

		var id = parts[1];

		if (id == 0) {
			let obj = this.emptyDocument();
			return Promise.resolve(this.convertSingleDocument({'data': { 'data': obj } }));
		}

		return this.getDocument(id).then((data) => this.convertSingleDocument(data));
	}


	return Promise.reject(new Error('Unrecognized url ' + url))
}

Subterfuge_Pimcore_Adapter.prototype.save = function(url, fd) {

	var parts = url.split(/\//);
	var id = parts[1];

	if (parts[0] == 'assets')
		return this.saveAsset(id, fd);

	if (parts[0] == 'documents')
		return this.saveDocument(id, fd);

	if (parts[0] == 'objects')
		return this.saveObject(parts[2], fd);

	return Promise.reject(new Error('Unrecognized url ' + url))
}

Subterfuge_Pimcore_Adapter.prototype.del = function(url) {

	var parts = url.split(/\//);
	var id = parts[1];

	if (parts[0] == 'assets')
		return this.deleteAsset(id);

	if (parts[0] == 'documents')
		return this.deleteDocument(id);

	if (parts[0] == 'objects')
		return this.deleteObject(parts[2]);

	return Promise.reject(new Error('Unrecognized url ' + url))
}

Subterfuge_Pimcore_Adapter.prototype.bulkdelete = function(ids) {
	return Promise.all(
		ids.map((id) => this.del(id))
	);
}

Subterfuge_Pimcore_Adapter.prototype.onFilter = function(url, params) {
	return url;
}


Subterfuge_Pimcore_Adapter.prototype.request = function(part, params, method) {
	var url = this.API_ROOT + part + '?apikey=' + this.API_KEY;
	method = method || 'GET';

	let post_params = method != 'GET';	

	return this.transport({
		'method': method,
		'url': url,
		'params': !post_params ? params : undefined,
		'data': post_params ? params : undefined,
	}).then((response) => {
		if (!response.data['success'])
			return Promise.reject(new Error('Remote: ' + response.data['msg']));
		else
			return Promise.resolve(response['data']);
	});
}

Subterfuge_Pimcore_Adapter.prototype.deleteObject = function(id) {

	var obj = this.object_cache[id];
	//var fd = new FormData();

	return this.request('object/id/'+obj.id, null, "DELETE").then((data) => {
		return Promise.resolve({
			'goto': 'objects/' + obj.className
		});
	});
}

Subterfuge_Pimcore_Adapter.prototype.deleteAsset = function(id) {

	return this.request('asset/id/'+id, null, "DELETE").then((data) => {
		return Promise.resolve({
			'goto': 'assets'
		});
	});
}

Subterfuge_Pimcore_Adapter.prototype.deleteDocument = function(id) {

	return this.request('document/id/'+id, null, "DELETE").then((data) => {
		return Promise.resolve({
			'goto': 'documents'
		});
	});

}


Subterfuge_Pimcore_Adapter.prototype.saveObject = function(id, iFD) {

	var obj = this.object_cache[id];

	var fd = new FormData();

	var data = { 
		'id': parseInt(id),	
		'parentId': obj.parentId,
		'key': obj.key,
		'type': 'object',
		'className': obj.className,
		'published': obj.published,
		'elements': [ ],
	}

	for (var pair of iFD.entries()) {
		if (pair[0] == 'o_published') {
			data['published'] = pair[1];
		} else
		data['elements'].push({
			'type'    : 'input',
			'name'    : pair[0],
			'value'   : pair[1],
			'language': null,
		});
	}

	var push = {
		'apikey': this.API_KEY,
		'data'  : data,
	}
	var text = JSON.stringify(data);

	return this.request('object', text, "POST").then((data) => {
		//hack -- simulate redirect for new objects
		if (id==0) {
			return Promise.resolve({
				'goto': 'objects/' + obj.className + '/' + response.data['id']
			});
		}
		return Promise.resolve(data);
	});
}

Subterfuge_Pimcore_Adapter.prototype.saveAsset = function(id, iFD) {

	var obj = this.asset_cache[id];

	var fd = new FormData();

	var data = { 
		'id': parseInt(id),	
		'parentId': obj.parentId,
		'key': obj.key,
		'type': 'object',
		'className': obj.className,
		'published': obj.published,
		'elements': [ ],
	}

	for (var pair of iFD.entries()) {
		if (pair[0] == 'o_published') {
			data['published'] = pair[1];
		} else
		data['elements'].push({
			'type'    : 'input',
			'name'    : pair[0],
			'value'   : pair[1],
			'language': null,
		});
	}

	/*var push = {
		'apikey': this.API_KEY,
		'data'  : data,
	}*/
	var text = JSON.stringify(data);

	return this.request('asset', text, "POST").then((data) => {
		//hack -- simulate redirect for new objects

		//NOTICE:
		//we receive response,
		//but only pass down the data from it (IN SOME CASES)
		//this is crazily incosistent and wrong
		if (id==0) {
			return Promise.resolve({
				'goto': 'assets/' + response.data['id']
			});
		}
		return Promise.resolve(data);
	});
}

Subterfuge_Pimcore_Adapter.prototype.saveDocument = function(id, iFD) {

	var obj = this.document_cache[id];

	var fd = new FormData();

	var data = { 
		'id': parseInt(id),	
		'parentId': obj.parentId,
		'key': obj.key,
		'type': 'object',
		'className': obj.className,
		'published': obj.published,
		'elements': [ ],
	}

	for (var pair of iFD.entries()) {
		if (pair[0] == 'o_published') {
			data['published'] = pair[1];
		} else
		data['elements'].push({
			'type'    : 'input',
			'name'    : pair[0],
			'value'   : pair[1],
			'language': null,
		});
	}

	/*var push = {
		'apikey': this.API_KEY,
		'data'  : data,
	}*/
	var text = JSON.stringify(data);

	return this.request('document', text, "POST").then((data) => {
		//hack -- simulate redirect for new objects

		if (id==0) {
			return Promise.resolve({
				'goto': 'documents/' + response.data['id']
			});
		}
		return Promise.resolve(data);
	});
}

Subterfuge_Pimcore_Adapter.prototype.newPager = function(options, prefix) {
	var pager = new Subterfuge_Page_Helper();

	let limit = options['limit'] || 25;
	let offset = options['offset'] || 0;
	let total  = options['total'] || 10;

	pager.setSlice(offset, limit, total);

	pager.setPrefix(prefix);
	pager.sort_key_var = 's';
	pager.sort_dir_var = 's';

	if (options['orderKey']) {
		pager.addSorter(options['orderKey'], options['order']);
		pager.setSort(options['orderKey'], options['order']);
	}

	return pager;
}

Subterfuge_Pimcore_Adapter.prototype.listQueryParams = function(options, headers, className, pub) {
	var id_key = className ? 'o_id' : 'id';
	var pub_key = className ? 'o_published': 'published';
	var limit = 25;
	var offset = 0;
	var oKey = id_key;
	var oDir = 'DESC';
	let conditions = [ ];

	if (options['p']) {

		offset = (parseInt(options['p']) - 1) * limit;

	}
	if (options['s']) {

		oKey = options['s'];
		oDir = 'ASC';

		if (oKey[0] == '-') {
			oDir = 'DESC';
			oKey = oKey.substring(1, oKey.length);
		}
	}

	if (pub) {
		if (options['pub'] === undefined) options['pub'] = 1;
		if (options['pub']) {
			conditions.push(encodeURIComponent(
				pub_key + '=' + '"'+(parseInt(options['pub'])? '1':'0')+'"'
			)); 
		}
	}

	for (var i = 0; i < headers.length; i++) {
		let head = headers[i];
		if (options[head.name]) {
			conditions.push(encodeURIComponent(
				'`'+head.name+'`' + ' LIKE ' + '"%' + options[head.name] + '%"'
			));
			//console.log(head.name + ' LIKE ' + '"%' + options[head.name] + '%"');
		}
	}
	var queryParams = {
		'offset' : offset,
		'limit'  : limit,
		//'objectClass': className,
		'orderKey': oKey,
		'order'   : oDir,
		'condition': conditions.join(' AND '),
	}

	if (className) queryParams['objectClass'] = className;

	return queryParams;
}

Subterfuge_Pimcore_Adapter.prototype.listAllClasses = function() {
	return this.request('classes');
}

Subterfuge_Pimcore_Adapter.prototype.listObjects = function(className, options) {
	let headers = this.adaptedHeadersFor(className);

	let queryParams = this.listQueryParams(options, headers, className, 1);

	return this.request('object-count', {
		'objectClass': className,
		'condition': queryParams['condition'],
	}).then((data) => {

		var data = data.data;
		queryParams['total'] = data.totalCount;
		return this.request('object-list', queryParams);

	}).then((data) => {

		var data = data.data;
		var need = [ ]
		for (var i = 0; i < data.length; i++) {
			var item = data[i];
			need.push( this.getObject(item.id).then((data) => this.readObjectData(data)) );
		}
		return Promise.all(need);

	}).then((objects) => {

		return Promise.resolve( this.convertObjectList(objects, className, queryParams, options) );

	});
}

Subterfuge_Pimcore_Adapter.prototype.listAssets = function(options) {
	let headers = this.assetHeaders();
	
	var queryParams = this.listQueryParams(options, headers, null, 0);

	return this.request('asset-count', {
		'condition': queryParams['condition']
	}).then((data) => {

		var data = data.data;
		queryParams['total'] = data.totalCount;
		return this.request('asset-list', queryParams);

	}).then((data) => {

		var data = data.data;
		var need = [ ]
		for (var i = 0; i < data.length; i++) {
			var item = data[i];
			need.push( this.getAsset(item.id, true).then((data) => this.readAssetData(data)) );
		}
		return Promise.all(need);
	}).then((assets) => {

		return Promise.resolve( this.convertAssetList(assets, queryParams, options) );

	});
}

Subterfuge_Pimcore_Adapter.prototype.listDocuments = function(options) {
	let headers = this.documentHeaders();

	let queryParams = this.listQueryParams(options, headers, null, 1);

	return this.request('document-count', {
		'condition': queryParams['condition']
	}).then((data) => {

		var data = data.data;
		queryParams['total'] = data.totalCount;
		return this.request('document-list', queryParams);

	}).then((data) => {

		var data = data.data;
		var need = [ ]
		for (var i = 0; i < data.length; i++) {
			var item = data[i];
			need.push( this.getDocument(item.id).then((data) => this.readDocumentData(data)) );
		}
		return Promise.all(need);
	}).then((documents) => {

		return Promise.resolve( this.convertDocumentList(documents, queryParams, options) );

	});
}

Subterfuge_Pimcore_Adapter.prototype.getObject = function(id) {
	return this.request('object/id/' + id);
}

Subterfuge_Pimcore_Adapter.prototype.getClass = function(id) {
	return this.request('class/id/' + id);
}

Subterfuge_Pimcore_Adapter.prototype.getDocument = function(id) {
	return this.request('document/id/' + id);
}
Subterfuge_Pimcore_Adapter.prototype.getAsset = function(id, light) {
	var params = light ? params = { 'light': 1 } : undefined;
	return this.request('asset/id/' + id, params);
}

Subterfuge_Pimcore_Adapter.prototype.getClassDefinition = function(name) {
	if (!this.class_map[name]) {
		var id = this.class_name2id[name];

		if (!id)
			return Promise.reject(new Error('Unknown class id'))

		return this.getClass(id).then((rdata) => {
			this.class_map[name] = this.readClassData(rdata);
			this.class_info[name] = this.readClassData2(rdata);
			return this.class_map[name];
		});
	}
	return Promise.resolve(this.class_map[name]);
}

Subterfuge_Pimcore_Adapter.prototype.readClassList = function(data) {
	var data = data.data;
	var promises = [ ]
	for (var i = 0; i < data.length; i++) {
		var item = data[i];

		this.class_name2id[ item.name ] = item.id;
		this.class_id2name[ item.id ] = item.name;

		promises.push( this.getClassDefinition(item.name) )
	}

	return Promise.all(promises);
}

Subterfuge_Pimcore_Adapter.prototype.convertClassList = function(classNames) {
	var mitems = [ ];
	for (var id in classNames) {
		var name = classNames[id];
		var info = this.class_info[name];

		mitems.push({
			'name' : name,
			'label': this.utils.ucfirst(name),//item['name'],
			'href' : 'objects/' + name,//'objects/' + item['id'] + '/' + item['name'],
			'icon' : info ? info['icon'] : '', 
		});
	}
	console.log(mitems);
	/* Hack */
	mitems.push({
		'name' : 'assets',
		'label': 'Assets',
		'href' : 'assets',
	});
	mitems.push({
		'name' : 'documents',
		'label': 'Documents',
		'href' : 'documents',
	});
	this.saved_menu = mitems;
	return {
		'menu': mitems
	}
}

Subterfuge_Pimcore_Adapter.prototype.documentHeaders = function() {
	var headers = [ ];
	var keys = [ 'key', 'path', 'type', 'published' ];
	for (var k in keys) {
		var key = keys[k];
		headers.push({
			'name' : key,
			'label': this.utils.ucfirst(key),
			'href' : '',
			'cls'  : '',
		});
	}
	return headers;
}

Subterfuge_Pimcore_Adapter.prototype.assetHeaders = function() {
	var headers = [ ];
	var keys = [ 'filename', 'path', 'type' ];
	for (var k in keys) {
		var key = keys[k];
		headers.push({
			'name' : key,
			'label': this.utils.ucfirst(key),
			'href' : '',
			'cls'  : '',
		});
	}
	return headers;
}

Subterfuge_Pimcore_Adapter.prototype.adaptedHeadersFor = function(className) {
	var map = this.class_map[className];
	//console.log("MAP:", map, className, this.class_map);
	var headers = [ ];
	for (var i = 0; i < map.length; i++) {
		let hitem = map[i];
		if (!hitem.visibleGridView) continue;
		headers.push({
			'name' : hitem.name,
			//'type': hitem.fieldtype,
			'label': hitem.title,
			'href' : 'objects/' + className + '?s=' + hitem.name,
			'cls'  : '',
		});
	}
	return headers;
}

Subterfuge_Pimcore_Adapter.prototype.adaptedFieldsFor = function(className) {
	var map = this.class_map[className];
	var headers = [ ];
	for (var i = 0; i < map.length; i++) {
		var hitem = map[i];
		if (hitem.noteditable) continue;
		headers.push({
			'name': hitem.name,
			'type': this.convertType(hitem.fieldtype),
			'label': hitem.title,
			'options': this.convertOptions(hitem.options),
		});
	}
	return headers;
}

Subterfuge_Pimcore_Adapter.prototype.emptyObject = function(className) {

	var obj = { };

	obj.id = 0;
	obj.elements = [ ];
	obj.type = 'object';
	obj.className = className;
	obj.key = className.toLowerCase() + '-' + this.utils.randomID(6);
	obj.parentId = 1;
	obj.published = true;

	var headers = this.adaptedFieldsFor(className);

	for (var i = 0; i < headers.length; i++) {
		var hitem = headers[i];
		
		obj.elements.push({
			'name': hitem.name,
			'value': '',
		});
	}
	return obj;
};

Subterfuge_Pimcore_Adapter.prototype.convertSingleObject = function(response, className) {
	var obj = response.data;

	this.object_cache[ obj.id ] = obj; 

	var headers = this.adaptedFieldsFor(className);

	var ele_by_name = { }
	for (var k = 0; k < obj.elements.length; k++) {
		var elem = obj.elements[k];
		ele_by_name[ elem.name ] = elem;
	}

	var fields = headers.map((hitem) => { return {
		'name' : hitem.name,
		'label': hitem.label,
		'type' : hitem.type,
		'value': ele_by_name[ hitem.name ].value,
		'options': hitem.options,
		'group': 'elements',
	}});
	fields.push({
		'name' : 'o_published',
		'label': 'Published',
		'type' : 'checkbox',
		'value': obj.published ? 1 : 0,
		'group': 'pimcore',
	});

	var classTitle = this.utils.ucfirst(obj.className);

	var form = {
		'href': 'objects/' + className + '/' + obj.id,
		'title': (!obj.id ? 'new ' + classTitle : classTitle + ' ' + obj.id),
		'fields': fields,
		'groups': [
			{ 'label': 'Elements', 'name': 'elements' },
			{ 'label': 'Object', 'name': 'pimcore' },
		]
	}
	return {
		'menu': this.saved_menu,
		'form': form,
		'list': null,
	}
};

Subterfuge_Pimcore_Adapter.prototype.convertSingleAsset = function(response) {
	var obj = response.data;

	this.asset_cache[ obj.id ] = obj; 

	var headers = this.assetHeaders();

	var fields = headers.map((hitem) => { return {
		'name' : hitem.name,
		'label': hitem.label,
		'type' : hitem.type,
		'value': obj[ hitem.name ],
		'options': hitem.options,
	}});
	
	//if xxx == "image"
	if (1) {
		fields.push({
			'name' : '@image',
			'label': 'Preview',
			'type' : 'imagepreview',
			'value': 'data:image;base64,' + obj.data,
		});
	} else {
		fields.push({
			'name' : '@data',
			'label': 'File',
			'type' : 'file',
			'value': '',
		});
	}
	

	var classTitle = 'Asset';

	var form = {
		'href': 'assets/' + obj.id,
		'title': (!obj.id ? 'new ' + classTitle : classTitle + ' ' + obj.id),
		'fields': fields,
	}
	return {
		'menu': this.saved_menu,
		'form': form,
		'list': null,
	}
};

Subterfuge_Pimcore_Adapter.prototype.convertSingleDocument = function(response) {
	var obj = response.data;

	this.document_cache[ obj.id ] = obj; 

	var ele_by_name = { }
	for (var k = 0; k < obj.elements.length; k++) {
		var elem = obj.elements[k];
		ele_by_name[ elem.name ] = elem;
	}

	var headers = this.documentHeaders();
	var fields = obj.elements.map((elem) => { return {
		'name' : elem.name,
		'label': elem.value.realName
			? elem.value.realName
			: this.utils.ucfirst(elem.name),
		'type' : this.convertType(elem.type),
		'value': elem.value.text, 
		'options': this.convertOptions(elem.value.options),
	}});

	var classTitle = 'Document';

	var form = {
		'href': 'documents/' + obj.id,
		'title': (!obj.id ? 'new ' + classTitle : classTitle + ' ' + obj.id),
		'fields': fields,
	}
	return {
		'menu': this.saved_menu,
		'form': form,
		'list': null,
	}
};



Subterfuge_Pimcore_Adapter.prototype.convertObjectList = function(objs, className, options, _filters) {
	var pager = this.newPager(options, 'objects/' + className + '?');

	var headers = this.adaptedHeadersFor(className);

	var filters = [ ];
	for (let i = 0; i < headers.length; i++) {
		let head = headers[i];
		filters.push({
			'name': head.name,
			'type': 'text',
			'label': head.label,
			'value': _filters[head.name] || '',
		});
		pager.addFilter(head.name, _filters[head.name] || '');
	}
	filters.push({
		'name': 'pub',
		'type': 'toggle',
		'label': '',
		'options': [
			{ 'label': 'published', 'value': 1 },
			{ 'label': 'unpublished', 'value': 0 },
		],
		'value': _filters['pub'] || 1,
	});
	pager.addFilter('pub', _filters['pub'] || 1);

	for (let i = 0; i < headers.length; i++) {
		headers[i]['cls'] = pager.sortClass(headers[i].name);
		headers[i]['href'] = pager.sortURL(headers[i].name);	
	}

	var classTitle = this.utils.ucfirst(className);

	var items = [ ];
	for (var i = 0; i < objs.length; i++) {
		var obj = objs[i];
		//console.log("Object", i, obj);

		//hackz - get some minimal info from lists
		if (!this.object_cache[obj.id]) {
			this.object_cache[obj.id] = { 
				'id': obj.id, 'className': className
			};
		}
		var ele_by_name = { }
		for (var k = 0; k < obj.elements.length; k++) {
			var elem = obj.elements[k];
			ele_by_name[ elem.name ] = elem;
		}
		var columns = headers.map((head) => {
			let elem = ele_by_name[head.name];
			return elem ? elem.value : undefined;
		});
		items.push({
			'href': 'objects/' + className + '/' + obj.id,
			'title': classTitle + ' ' + obj.id,
			'columns': columns,
		});
	}

	var lst = {
		'filters': filters,
		'headers': headers,
		'items': items,
		'pages': pager.pagesArray(),
		'create_href': 'objects/' + className + '/' + 0,
		'filter_href': pager.unfilteredURL(),
	}
	return {
		'menu': this.saved_menu,
		'menu_active': className,
		'title': pager.fullText(classTitle),
		'list': lst,
		'form': null,
	};
}

Subterfuge_Pimcore_Adapter.prototype.convertAssetList = function(objs, options, _filters) {
	var pager = this.newPager(options, 'assets?');

	var headers = this.assetHeaders();

	var filters = [ ];
	for (let i = 0; i < headers.length; i++) {
		let head = headers[i];
		filters.push({
			'name': head.name,
			'type': 'text',
			'label': head.label,
			'value': _filters[head.name] || '',
		});
		pager.addFilter(head.name, _filters[head.name] || '');
	}

	for (let i = 0; i < headers.length; i++) {
		headers[i]['cls'] = pager.sortClass(headers[i].name);
		headers[i]['href'] = pager.sortURL(headers[i].name);	
	}

	var items = objs.map((obj) => { return {
		'title': 'Asset ' + obj.id,
		'columns': headers.map((head) => obj[head.name]),
		'href': 'assets/' + obj.id,
	}});

	var lst = {
		'filters': filters,
		'headers': headers,
		'items': items,
		'pages': pager.pagesArray(),
		'create_href': 'assets/' + 0,
		'filter_href': pager.unfilteredURL(),
	}
	return {
		'menu': this.saved_menu,
		'menu_active': 'assets',
		'title': pager.fullText('Assets'),
		'list': lst,
		'form': null,
	};
}

Subterfuge_Pimcore_Adapter.prototype.convertDocumentList = function(objs, options, _filters) {
	var pager = this.newPager(options, 'documents?');

	var headers = this.documentHeaders();

	var filters = headers.map((head) => { 
		pager.addFilter(head.name, _filters[head.name] || '');		
		return {
			'name': head.name,
			'type': 'text',
			'label': head.label,
			'value': _filters[head.name] || '',
		}
	});
	filters.push({
		'name': 'pub',
		'type': 'toggle',
		'label': '',
		'options': [
			{ 'label': 'published', 'value': 1 },
			{ 'label': 'unpublished', 'value': 0 },
		],
		'value': _filters['pub'] || 1,
	});
	pager.addFilter('pub', _filters['pub'] || 1);

	for (let i = 0; i < headers.length; i++) {
		headers[i]['cls'] = pager.sortClass(headers[i].name);
		headers[i]['href'] = pager.sortURL(headers[i].name);	
	}

	var items = objs.map((obj) => { return {
		'title': 'Document ' + obj.id,
		'columns': headers.map((head) => obj[head.name]),
		'href': 'documents/' + obj.id,
	}});

	var lst = {
		'filters': filters,
		'headers': headers,
		'items': items,
		'pages': pager.pagesArray(),
		'create_href': 'documents/' + 0,
		'filter_href': pager.unfilteredURL(),
	}
	return {
		'menu': this.saved_menu,
		'menu_active': 'documents',
		'title': pager.fullText('Documents'),
		'list': lst,
		'form': null,
	};
}


Subterfuge_Pimcore_Adapter.prototype.readClassData = function(rdata) {
	let cdata = rdata.data;
	if (!cdata.layoutDefinitions) {
		return new Error("Pimcore Class " + cdata.name + " has no definition");
	}
	return cdata.layoutDefinitions.childs[0].childs;
}

Subterfuge_Pimcore_Adapter.prototype.readClassData2 = function(rdata) {
	let cdata = rdata.data;
	return {'icon':cdata.icon};
}

Subterfuge_Pimcore_Adapter.prototype.readObjectData = function(rdata) {
	return rdata.data;
}
Subterfuge_Pimcore_Adapter.prototype.readAssetData = function(rdata) {
	return rdata.data;
}
Subterfuge_Pimcore_Adapter.prototype.readDocumentData = function(rdata) {
	return rdata.data;
}

Subterfuge_Pimcore_Adapter.prototype.optionMapper = function(pimoption) {
	return { 'value': pimoption['value'], 'label': pimoption['key'] };
}
Subterfuge_Pimcore_Adapter.prototype.convertOptions = function(options) {
	if (!options) return [ ];
	return options.map(this.optionMapper);
}
Subterfuge_Pimcore_Adapter.prototype.pimTypes = {
	'wysiwyg': 'textarea',
	'numeric': 'number',
	'input': 'text',
	'multiselect': 'select',
}
Subterfuge_Pimcore_Adapter.prototype.convertType = function(t) {
	return this.pimTypes[t] || t;
}

Subterfuge_Pimcore_Adapter.prototype.preview = function(url, field, value) {
	return Promise.resolve(value);
}
