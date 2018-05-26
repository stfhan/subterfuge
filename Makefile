# Tools

BABEL=node_modules/.bin/babel
define JS_MIN
	# using the jsmin C tool
	cat $1 | jsmin > $2
endef
#CSS_COMPRESS=yuic --charset utf-8
CSS_COMPRESS=./node_modules/.bin/cleancss

# Sources

ES6_SOURCES=src/layout.es6 src/subterfuge.es6
ES6_OBJECTS=$(ES6_SOURCES:.es6=.js)

JS_SOURCES=$(ES6_OBJECTS)
JS_OBJECTS=

JS_SOURCES_VENDOR=vendor/react.js vendor/react-dom.js
JS_OBJECTS_VENDOR=vendor/axios.min.js

CSS_SOURCES=vendor/shadowmatter.css src/subterfuge.css

# Targets

.SUFFIXES: .es6 .js .jsmin

dist: dist/subterfuge.min.js dist/subterfuge.min.css
	

vendor: dist/stf-vendor.min.js
	

clean:
	rm dist/* src/*.js

dist/stf-vendor.js: $(JS_SOURCES_VENDOR)
	cat $^ > $@

dist/stf-vendor.min.js: dist/stf-vendor.js $(JS_OBJECTS_VENDOR)
	$(call JS_MIN, $<, $@)
	echo "" >> $@
	cat $(JS_OBJECTS_VENDOR) >> $@
	echo "" >> $@

dist/stf-core.js: $(JS_SOURCES)
	cat $^ > $@

dist/stf-core.min.js: dist/stf-core.js
	$(call JS_MIN, $<, $@)
	#cat $< | $(COMPRESS) > $@

dist/subterfuge.min.js: dist/stf-vendor.min.js dist/stf-core.min.js
	cat $^ > $@

dist/stf-core.css: $(CSS_SOURCES)
	cat $^ > $@

dist/subterfuge.min.css: dist/stf-core.css
	$(CSS_COMPRESS) $< -o $@

.es6.js:
	$(BABEL) $< -o $@


## Plugins

dist/stf-wordpress.js: src/subterfuge.wordpress.js vendor/xmlrpc.js
	cat ^$ > $@

dist/subterfuge.wordpress.min.js: src/stf-wordpress.js
	$(call JS_MIN, $<, $@)

github: dist/subterfuge.github.min.js
	

src/subterfuge.github.js: src/subterfuge.github.es6
	$(BABEL) $< -o $@

dist/subterfuge.github.min.js: src/subterfuge.github.js
	$(call JS_MIN, $<, $@)
