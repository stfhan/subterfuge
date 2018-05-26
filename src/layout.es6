function MenuEntry(props) {
	return (
		<a href={props.href} className={'c-btn ' + (props.active ? 'active': '')}>
			{props.icon ? <img src={props.icon} width="16" />: null}
			{props.label}
			{props.active}
		</a>
	)
}
function MainMenu(props) {
	if (!props) return null;
	const entries = props.entries.map((e) => {

		return <MenuEntry key={e.href} active={props.active==e.name} {...e}/>
	}
	)
	return (
		<nav>
			{entries}
		</nav>
	)
}



function ListHeader(props) {
	return (
		<th className={'list-header ' + props.cls}>
			<a href={props.href}>
				{props.label}
			</a>
		</th>
	)
}

class ListFilterSearch extends React.Component {
	constructor(props) {
		super(props)
		this.state = {
			'value': props.value
		}
		this.handleChange = this.handleChange.bind(this);
	}
	handleChange(event) {
		this.setState({'value': event.target.value});
	}
	componentWillReceiveProps(props) {
		if (props.value != this.state.value) {
			this.setState({'value': props.value});
		}
	}
	render() {
		return (
			<input type="text"
				onChange={this.handleChange}
				className={'c-input' + (!this.state.value ? ' empty':'')}  
				name={this.props.name}
				value={this.state.value}
				placeholder={this.props.label}
			/>
		);
	}
}

class ListFilterToggle extends React.Component {
	constructor(props) {
		super(props);
		this.state = { 'value': props.options[0].value }
		this.handleClick = this.handleClick.bind(this);
	}
	componentWillReceiveProps(props) {
		if (props.value != this.state.value) {
			this.setState({'value': props.value});
		}
	}
	handleClick(event) {
		let btn = event.target;
		let name = btn.getAttribute('data-name')
		let value = btn.getAttribute('data-value')
		this.setState({'value': value});
	}
	render() {
		if (!this.props.options) return null;
		const options = this.props.options.map((o) => 
			<button key={o.value} onClick={this.handleClick}
				data-name={this.props.name} data-value={o.value}
				data-href={o.href} 
				className={'c-btn-toggle ' + (this.state.value == o.value ? 'stf-active active':'')}>
				{o.label}
			</button>
		);
		return (
			<div className="c-toggle-group">
				<label>
					{this.props.label}
				</label>
				{options}
			</div>
		);
	}
}
/*
		<label data-href={props.href}>
			<input type="radio"
					value={props.value}
				/>{props.label}
		</label>

*/

function ListFilter(props) {
	const search_filter = <ListFilterSearch {...props}/>;
	const search_toggle = <ListFilterToggle {...props}/>;
	let widget = search_filter;
	if (props.type == 'toggle') {
		widget = search_toggle;
	}
	return (
		<div className="stf-filter">
			{widget}
		</div>
	);
}

class ItemList extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			'massCheck': false,
			'rowChecked': { }
		}
		this.handleMassCheck = this.handleMassCheck.bind(this);
		this.handleSingleCheck = this.handleSingleCheck.bind(this);
		this.state['rowChecked'] = this.compareCheckboxes(props);
		this.refreshCheckboxes();
	}
	compareCheckboxes(props) {
		var wasChecked = this.state.rowChecked;
		var newChecked = { }
		for (var i = 0; i < props.items.length; i++) {
			let item = props.items[i];
			if (wasChecked[item.href] == true)
				newChecked[item.href] = true;
		}
		return newChecked;
	}
	componentWillReceiveProps(props) {
		this.state['rowChecked'] = this.compareCheckboxes(props);
		this.refreshCheckboxes();
	}
	refreshCheckboxes() {
		let n = this.numChecked();
		let m = this.props.items.length;
		setTimeout(() => this.setState({
			'rowChecked': this.state['rowChecked'],
			'massCheck': n < m || m < 1 ? false : true,
		}));
	}
	numChecked() {
		return this.props.items.reduce((a, item, i) => {
			return a + (this.state.rowChecked[item.href] ? 1 : 0);
		}, 0);
	}
	handleMassCheck(event) {
		let val = event.target.checked;
		let all = this.state['rowChecked'];
		for (var i = 0; i < this.props.items.length; i++) {
			let item = this.props.items[i];
			all[item.href] = val;
		}
		this.refreshCheckboxes();
	}
	handleSingleCheck(id, on) {
		this.state['rowChecked'][id] = on;
		this.refreshCheckboxes();
	}
	render() {
		let props = this.props;
		if (!props) return null;
		const filters = props.filters.map((filt) =>
			<ListFilter
				key={filt.name}
				name={filt.name}
				label={filt.label}
				value={filt.value}
				type={filt.type}
				options={filt.options}
			/>
		);
		const headers = props.headers.map((head) =>
			<ListHeader
				key={head.name}
				label={head.label}
				href={head.href}
				cls={head.cls} 
			/>
		);
		const items = props.items.map((item, i) =>
			<ListItem
				key={item.href} index={i}
				headers={props.headers}
				columns={item.columns}
				href={item.href}
				title={item.title}
				checked={!!this.state.rowChecked[item.href]}
				starred={this.props.checkStar(item.href)}
				callback={this.handleSingleCheck}
			/>
		);
		const numChecked = this.numChecked()
		let checkedBadge = numChecked ? 
			<span className="c-badge">{numChecked}</span> : '';

		return (
			<table className={'stf-item-list c-table c-table--zebra' +
					(filters.length ? ' stf-with-filters': '')	}>
				<thead className="stf-sticky-header">
				{filters.length ?
				<tr data-filter-base={props.filter_href} className="stf-list-filters">
					<td colSpan={headers.length + 1}>
						{filters}
						<button type="button" className="c-btn s-primary" data-action="filter">
							Find
						</button>
					</td>
				</tr>
				: null }
				<tr className="stf-list-headers">
					<th>
						<label className="c-toggle"><input 
							type="checkbox" 
							onChange={this.handleMassCheck}
							checked={this.state.massCheck}
						/><i></i></label>
						{checkedBadge}
					</th>
					{headers}
				</tr>
				</thead>
				<tbody className="stf-list-contents">
					{items}
				</tbody>
			</table>
		)
	};
}
class ListItem extends React.Component {
	constructor(props) {
		super(props);
		this.handleCheckbox = this.handleCheckbox.bind(this);
	}
	handleCheckbox(event) {
		this.props.callback(this.props.href, event.target.checked);
	}
	render() {
		let p = this.props
		const columns = p.columns.map((column, i) =>
			<ItemColumn key={i} type={p.headers[i].type} value={column}/>
		);
		return (
			<tr className={'stf-item-row ' + (this.props.checked ? 'is-selected':'')}>
				<td>
					<StarBox
						href={p.href}
						title={p.title}
						starred={this.props.starred}
					/>

					<label className="c-toggle"><input
						type="checkbox"
						onClick={this.handleCheckbox} 
						checked={this.props.checked}
						value={p.href}
					/><i></i></label>

					<a href={p.href}>{p.title}</a>
				</td>
				{columns}
			</tr>
		)
	}
}
function ItemColumn(props) {
	let value = props.value
	switch(props.type) {
		case 'hidden':
			value = '';
		break;
	}
	return (
		<td className="col">
			{value}
		</td>
	)
}

function SelectOption(props) {
	return (
		<option value={props.tag}>{props.tag} = {props.label}</option>
	)
}

class SelectWidget extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			'value': props.field.value
		}
		this.handleChange = this.handleChange.bind(this);
	}
	handleChange(event) {
		if (this.props.field.multiple) {
			var options = event.target.options;
			var arr = [];
			for (var i = 0, l = options.length; i < l; i++) {
				if (options[i].selected) {
					arr.push(options[i].value);
				}
			}
			this.setState({'value': arr});
			return;
			console.log("CHANGE:",  event.target.value);
			let i = this.state.value.indexOf(event.target.value);
			let arr = this.state.value.slice();
			if (i != -1) {
				arr.splice(i, 1);
			} else {
				arr.push(event.target.value);
			}
			this.setState({'value': arr});
			return;
		}
		this.setState({'value': event.target.value});
	}
	render() {
		const options = this.props.field.options.map((opt) => 
			<SelectOption key={opt.value} tag={opt.value} label={opt.label}/>
		);
		return (
			<select className="c-input" 

				onChange={this.handleChange} 
			
				name={this.props.field.name}
				value={this.state.value}
				
				multiple={this.props.field.multiple} 
			>
			{options}
			</select>
		);
	}
}
class CheckboxWidget extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			'value': props.field.value
		}
		this.handleChange = this.handleChange.bind(this);
	}
	handleChange(event) {
		this.setState({'value': 1-event.target.value});
	}
	render() {
		return (
			<label class="c-toggle">
				<input 

				onClick={this.handleChange}
				readOnly={true}

				type="checkbox" 
				name={this.props.field.name}
				checked={this.state.value} 
				value={this.state.value} />		
				<i></i>

			</label>
		);
	}
}

class TextInputWidget extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			'value': props.field.value
		}
		this.handleChange = this.handleChange.bind(this);
		this.handleFocus = this.handleFocus.bind(this);
	}
	handleChange(event) {
		if (this.props.field.type == 'title')
			this.props.titlecallback(event, event.target.value);
		this.setState({'value': event.target.value});
	}
	handleFocus(event) {
		this.props.focuscallback(event, event.target.name);
	}
	render() {
	return (
		<input className="c-input" 

			onChange={this.handleChange}
			onFocus={this.handleFocus}

			type={this.props.field.type} 
			name={this.props.field.name} 
			value={this.state.value} />
	);
	}
}

class TextAreaWidget extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			'value': props.field.value
		}
		this.handleChange = this.handleChange.bind(this);
		this.handleFocus = this.handleFocus.bind(this);
		this.handleDrop = this.handleDrop.bind(this);
	}
	handleChange(event) {
		this.setState({'value': event.target.value});
	}
	handleFocus(event) {
		this.props.focuscallback(event, event.target.name);
	}
	handleDrop(event) {
		this.props.dropcallback(event);
	}
	render() {
	return (
		<textarea className="c-input" 

			onChange={this.handleChange}
			onFocus={this.handleFocus}
			onDrop={this.handleDrop} 

			type={this.props.field.type} 
			name={this.props.field.name} 
			value={this.state.value} />
	);
	}
}

function ImagePreviewWidget(props) {
	return (
		<img src={props.field.value} className="stf-preview-image" />
	);
}

class FormField extends React.Component {
	constructor(props) {
		super(props);
	}
	render() {
		let widget = null;
		switch(this.props.field.type) {
			case 'select':
				widget = <SelectWidget {...this.props}/>
				break;
			case 'checkbox':
				widget = <CheckboxWidget {...this.props}/>
				break;
			case 'textarea':
				widget = <TextAreaWidget {...this.props}/>
				break;
			case 'imagepreview':
				widget = <ImagePreviewWidget {...this.props}/>
				break;
			case 'image':
				this.props.field.type = 'text';
			default:
				widget = <TextInputWidget {...this.props} titlecallback={this.props.titlecallback}/>
		}
		return (
			<div className={'o-grid' + (this.props.visible ? '':' hidden')}>
				<div className="o-grid__col o-grid__col--3-of-12">
					<label className="c-label">
						{this.props.field.label}
					</label>
				</div>
				<div className="o-grid__col o-grid__col--9-of-12">
					{widget}
				</div>
			</div>
		);
	}
}

class FormGroup extends React.Component {
	constructor(props) {
		super(props);
		this.handleClick = this.handleClick.bind(this);
	}
	handleClick(event) {
		this.props.callback(event, this.props.group.name);
	}
	render() {
		let cls = this.props.selected ? 'active' : '';
		return(
			<button type="button"
				className={cls}
				onClick={this.handleClick}>
				{this.props.group.label}
			</button>
		)
	}
}

class Form extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			'group': 
				(props.groups && props.groups.length) 
				? props.groups[0].name
				: '',
			'focused': props.autofocus_field,
		}
		this.handleNav = this.handleNav.bind(this);
		this.handleSubmit = this.handleSubmit.bind(this);
		this.handleRetitle = this.handleRetitle.bind(this);
		this.handleRefocus = this.handleRefocus.bind(this);
		//this.handleRepreview = this.handleRepreview.bind(this);
	}
	handleNav(event, group) {
		this.setState({'group':group});
	}
	handleSubmit(event) {
		event.preventDefault();
		this.props.submitcallback();
	}
	handleRetitle(event, retitle) {
		this.props.titlecallback(this.props.href, retitle);
	}
	handleRefocus(event, focused) {
		this.setState({'focused':focused});
		this.props.focuscallback(this.props.href, focused);
	}
	//handleRepreview(event) {
	//	stf.preview();
	//	//this.setState({'focused':focused});
	//	//this.props.titlecallback(this.props.href, retitle);
	//}
	render() {
		if (!this.props) return null;
		const groups = this.props.groups ? 
		this.props.groups.map((item) =>
			<FormGroup key={item.name} 
				group={item}
				selected={item.name == this.state.group}
				callback={this.handleNav}
			/>
		) : null;
		let preview = null;
		const fields = this.props.fields.map((item) => {
			if (this.state.focused == item.name) {
				preview = item.preview;
			}
			return <FormField key={item.name} 
				field={item}
				visible={!this.state.group || item.group == this.state.group}
				titlecallback={this.handleRetitle}
				focuscallback={this.handleRefocus}
			/>
		})
		return (
			<form data-object-uri={this.props.href} onSubmit={this.handleSubmit}>
				<div className="stf-form-header stf-sticky-header">
					<div className="stf-form-caption">

						<StarBox 
							href={this.props.href} 
							title={this.props.title}
							starred={this.props.starred}
						/>
						<h3>{this.props.title}</h3>
						<small>{this.props.href}</small>
					</div>
					<div className="stf-form-groups">
						{groups}
					</div>
				</div>
				{ preview ?
					<div className="stf-form-preview">
						<button type="button" data-action="preview" className="c-btn">
							<span className="stf-icon-eye"></span>
						</button>
					 	<div dangerouslySetInnerHTML={{ __html: preview }}></div>
					</div>
				: '' }
				{fields}
			</form>
		);
	}
}

function StarBox(props) {
	return (
		<span
			className={'stf-starbox' + (props.starred?' active':'')}
			data-bookmark={props.href}
			data-title={props.title}
		></span>
	);
}

function Message(props) {
	return (
		<p className={'c-banner s-'+props.cls}>
			{props.text}
		</p>
	)
}
function HistoryEntry(props) {
	return (
		<div 
			className={'stf-history-entry' + (props.active ? ' active' : '') }  
			data-index={props.index}
		>
			{props.entry.title}
		</div>
	)
}
function BookmarkEntry(props) {
	return (
		<a 
			className="stf-bookmark-entry"  
			href={props.href}
			data-title={props.title}
		>
			{props.href}: {props.title}
		</a>
	)
}


class SidePanel extends React.Component {
	constructor(props) {
		super(props);
		//this.handleNav = this.handleNav.bind(this);
	}
	render() {
		const messages = this.props.messages.map((m) =>
			<Message key={m.id} text={m.text} cls={m.cls}/>
		);
		const history = this.props.history.map((m, ind) =>
			<HistoryEntry key={ind} index={ind} entry={m} active={this.props.history_cursor >= ind}/>
		);
		const bookmarks = this.props.bookmarks.map((b) =>
			<BookmarkEntry key={b.href} title={b.title} href={b.href}/>
		);
		return (
			<div style={{height: '100%'}}>
				<div className="stf-messages">
					{messages}
				</div>
				<div className="stf-sidetoggle c-toggle-group">
					<button data-href="dashboard" type="button" className="c-btn-toggle">
						<span className="stf-icon-home"></span>
					</button>
					<button className={'c-btn-toggle ' + (this.props.tab == 'history' ? 'active' : '')} data-ui="sidebar.history" type="button">
						<span className="stf-icon-history"></span>
					</button>
					<button className={'c-btn-toggle ' + (this.props.tab == 'bookmarks' ? 'active' : '')} data-ui="sidebar.bookmarks" type="button">
						<span className="stf-icon-star"></span>
					</button>
				</div>
				{ this.props.tab == 'history' ?
				<div className="stf-history">
					{history}
				</div>
				: '' }
				{ this.props.tab == 'bookmarks' ?
				<div className="stf-bookmarks">
					{bookmarks}
				</div>
				: '' }
			</div>
		);
	}
}

function PageLink(props) {
	return (
		<a href={props.href} className={props.cls}>
			{props.label}
		</a>
	)
}

function Paginator(props) {
	if (!props || !props.pages) return null;
	const pages = props.pages.map((o) => PageLink(o));
	return (
		<div className="pagination">
			{pages}
		</div>
	)
}

function FormButtons(props) {
	return (
	<p className="buttons">
		<button data-action="save"
			className="c-btn s-primary">Save</button>
		<button data-action="delete"
			className="c-btn s-danger">Delete</button>
	</p>
	);
}

function ListButtons(props) {
	if (!props) return null;
	return (
	<p className="buttons">
		<button data-delete-me-action="create" data-href={props.create_href}
			className="c-btn s-primary">Create</button>
		<button data-action="bulkdelete"
			className="c-btn s-danger">Delete Selected</button>
	</p>
	);
}

function App(props) {
	const stf = props.stf;
	const mainmenu = <MainMenu entries={props.menu} active={props.menu_active}/>
	const listing = <ItemList {...props.list} checkStar={checkStar}/>
	const listbuttons = ListButtons(props.list)
	const pagination = Paginator(props.list)
	const form = <Form {...props.form}
		starred={props.form ? checkStar(props.form.href) : false} 
		titlecallback={formtitle}
		focuscallback={formfocus}
		submitcallback={formsubmit}
		dropcallback={formdrop}
	/>
	const formbuttons = FormButtons(props.form)

	function filtersubmit() {
		stf.filt();
	}
	
	function formsubmit() {
		stf.save();
	}

	function formtitle(url, title) {
		stf.importTitle(url, title);
		stf.redraw();
	}

	function formfocus(url, name) {
		stf._last_input = name;
	}
	
	function formdrop(event, ref) {
		stf.drop(event, ref);
		stf.redraw();
	}

	function checkStar(id) {
		return stf.isBookmarked(id);
	}

	function clicker(e) {
		if (e.target.nodeName == 'A') {
			e.preventDefault();
		}
		if (e.target.hasAttribute('href')/* e.target.nodeName == 'A'*/) {
			stf.route(e.target.getAttribute('href'), undefined, undefined, e.target.getAttribute('data-title') || e.target.textContent);
		}
		if (e.target.hasAttribute('data-bookmark')) {
			stf.toggleBookmark(e.target.getAttribute('data-bookmark'), e.target.getAttribute('data-title'));
		}
		if (e.target.hasAttribute('data-href')) {
			stf.route(e.target.getAttribute('data-href'), undefined, undefined, e.target.getAttribute('data-title'));
		}
		if (e.target.hasAttribute('data-index')) {
			var ind = e.target.getAttribute('data-index');
			stf.historyJump(ind, 'internal');
		}
		if (e.target.hasAttribute('data-ui')) {
			var cmd = e.target.getAttribute('data-ui');
			stf.ui(cmd);
		}
		if (e.target.hasAttribute('data-action')) {
			var act = e.target.getAttribute('data-action');
			switch(act) {
				case 'save':
				case 'create':
				case 'bulkdelete':
				case 'preview':
					stf[act]();
				break;
				case 'delete':
					stf.del();
				break;
				case 'filter':
					stf.filt();
				break;
			}
		}
	}

	return (
		<div className="stf-root" onClick={clicker}>
			<header>
			{props.menu ? mainmenu : '' }
			</header>
			<main>
			{props.form ? form  : ''}
			{props.list ? listing  : ''}
			</main>
			<aside>
			<SidePanel
				tab={props.side_tab} 
				messages={props.messages} 
				history={props.history}
				history_cursor={props.history_cursor}
				bookmarks={props.bookmarks}
			/>
			</aside>
			<footer>
			<PendingIndicator num={props.pending}/>
			{props.form ? formbuttons : ''}
			{props.list ? listbuttons : ''}
			{props.list ? pagination : ''}
			</footer>
		</div>
	)
}

function PendingIndicator(props) {
	const loading =	(
		<div className='indicator'>
			<div className="c-loader">Loading...</div>
		</div>
	)
	return(
			props.num > 0 ? loading : null
	);
}