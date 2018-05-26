//struct SubterfugeFrame
/* Represents complete state for a Subterfuge App. 
 Strictly speaking, none of the member values are required,
 however it is expected, that at least `list` or `form`
 is provided.
*/
{
	// If not provided, menu from previous frame might be reused.
	'menu': [
		//struct MenuItem
		{
			'href': 'posts', // Unique identifier.
			'label': 'Posts', // User-friendly title.
			'icon': '' // optional. Full URL to an svg/png/gif file.
			'active': false, // bool.
		}
	],
	// 
	'list':
		//struct ItemList
 		{
		'filters': [
			//struct ListFilter
			{
				'name': 'title',
				'type': 'search',
				'value': '',
			},
			//struct ListFilter
			{
				'name': 'status',
				'type': 'toggle',
				'options': [
					//struct Option
					{ 'value': 'publish', 'label': 'Published' },
					{ 'value': 'draft',   'label': 'Draft' },
				],
			}
		],
		'headers': [
			//struct ListHeader
			// NOTE: ListItem.columns and ListHeader must match 
			{ 'name': 'title',  'label': 'Title', href: 'posts?sort=title', 'cls': 'active asc' },
			{ 'name': 'status', 'label': 'Status', href: 'posts?sort=status', 'cls': '' }
		],
		'items': [
			//struct ListItem
			{
				'id': 1,
				'href': 'posts/1',
				'title': 'Post #1', //User-friendly title of this item
				'columns': [
					'Post #1',
					'Published',
				]
			}
		],
		'pages': [
			//struct ListPage
			{ 'label': 1, 'href': 'posts?p=1' },
		],
		'create_href': 'posts/0',//apu
		'filter_href': 'posts',//morbid
	},
	// 
	'form':
		//struct Form 
		{
			// 
			'href': 'posts/1',
			// 
			'title': 'Post #1',
			// 
			'fields': [
				//struct FormField
				{
					'name': 'title', //name of the field
					'value': 'Post #1',// current value
					'type': 'text', // enum FormWidget
					'options': [ 
						//struct Option
						{ 'value': '1', 'label': 'One' },
						{ 'value': '2', 'label': 'Two' },
					], //optional. Specifies options for multiple-choice widgets
					'group': '', //optional. If set, must match FormGroup `name`.
				}
			],
			//optional. If specified, splits form fields into several groups.
			'groups': [
				//struct FormGroup.
				// Represents a fieldset.
				// NOTE: FormField objects MUST have `group` value set.
				{ 'label': 'Main', 'name': 'main' },
			],
		},
	//optional. User-friendly title of this frame.
	'title': "",
	//optional. Currently selected MenuItem `name`
	'menu_active': "",
}
