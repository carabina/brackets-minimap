/*
 * Copyright (c) 2013 Website Duck LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*global brackets */
/*jslint es5: true */


define(function (require, exports, module) {

    var Config = require('Config'),
        MinimapMenus = require('MinimapMenus'),

        CodeMirror = require('runmode'),
        PreferencesManager = brackets.getModule('preferences/PreferencesManager'),
        ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        EditorManager = brackets.getModule('editor/EditorManager'),
        CommandManager = brackets.getModule('command/CommandManager'),
        MainViewManager = brackets.getModule("view/MainViewManager"),

        currentEditor,
        updateTimeout,
        hidden = false,
        dragging = false,
        contentCssRight = 0,
        resizeInterval,
        editorHeight = 0,
        currentTheme = 'cm-s-default',
        aspectRatio,

        minimapHtml = '\
            <div id="wdMinimap">\
                    <div id="visible_box"></div>\
                    <div id="mini_code" class="CodeMirror cm-s-default"></div>\
            </div>\
        ';

	function hide() {
        if (PreferencesManager.get('enabled')) {
			$('#wdMinimap').hide();
			//$('.main-view .content').css('right', contentCssRight + 'px');
			hidden = true;
		}
	}

	function show() {
        $('#wdMinimap').show();
		//$('.main-view .content').css('right', Config.MINIMAP_WIDTH + contentCssRight + 'px');
		hidden = false;
	}

	function enable() {
        contentCssRight = parseInt($('.main-view .content').css('right'));
		currentTheme = 'cm-s-default';
		$('.main-view .content').append(minimapHtml);
		//$('.main-view .content').css('right', Config.MINIMAP_WIDTH + contentCssRight + 'px');
		$("link[href$='brackets-minimap/main.css']").removeAttr("disabled");

		updateListeners();
		documentSwitch();

		resizeInterval = setInterval(function () {
			if (currentEditor) {
				if (editorHeight != $('#editor-holder').height()) {
					editorResize();
					editorHeight = $('#editor-holder').height();
				}
			}
            updateFont();
			setThemeColors();
		}, 500);
	}

	function disable() {
		$('#wdMinimap').remove();
		//$('.main-view .content').css('right', contentCssRight + 'px');
		$("link[href$='brackets-minimap/main.css']").attr("disabled", "disabled");

        updateListeners();
		clearInterval(resizeInterval);
	}

	function documentSwitch() {
		if (hidden) show();

		if (currentEditor) {
			$(currentEditor.document).off('.wdMinimap');
		}

		currentEditor = EditorManager.getCurrentFullEditor();
		if (!currentEditor) {
			$('#wdMinimap').hide();
			return;
		} else {
			$('#wdMinimap').show();
		}

		$('#wdMinimap #mini_code').css('top', 0);
		updateMinimapContent();

		$(currentEditor.document).on('change.wdMinimap', documentEdit);
		$(currentEditor).on('scroll.wdMinimap', editorScroll);
	}

	function documentClose() {
        if (MainViewManager.getWorkingSet().length == 0) {
            hide();
        }
	}

	function documentEdit() {
		clearTimeout(updateTimeout);
		updateTimeout = setTimeout(updateMinimapContent, 1000);
	}

    function updateListeners() {
        if (PreferencesManager.get('enabled')) {
            $(MainViewManager).on('currentFileChange.wdMinimap', documentSwitch);
            $(MainViewManager).on('workingSetRemove.wdMinimap', documentClose);
			$('#wdMinimap').on('mousedown.wdMinimap', mouseDown);
			$(document).on('mouseup.wdMinimap', mouseUp);
			$('#wdMinimap').on('mousemove.wdMinimap', mouseMove);

		} else {
			if (currentEditor) $(currentEditor.document).off('.wdMinimap');
			$(DocumentManager).off('.wdMinimap');
			$(document).off('.wdMinimap');
		}
	}

	function updateMinimapContent() {
        if (PreferencesManager.get('type') === 'plaintext') {
			$('#wdMinimap #mini_code').text(currentEditor.document.getText());
		} else {
			var fileType = currentEditor.getModeForDocument();
			var editor = CodeMirror.runMode(currentEditor.document.getText(), fileType, $('#wdMinimap #mini_code').get(0));
		}
		editorScroll();
	}

	function editorScroll() {
		var visBox = $('#wdMinimap #visible_box');
        var miniCode = $('#wdMinimap #mini_code');

		var hEditor = $('#editor-holder .CodeMirror:visible .CodeMirror-scroll').height();
        var hMiniCode = (miniCode.height() + parseInt(miniCode.css('padding-top')) + parseInt(miniCode.css('padding-bottom'))) / 4;
        var hCode = $('#editor-holder .CodeMirror-sizer:visible').height();
        var hMiniMap = $('#wdMinimap').height();
        var hScrollBar = Math.min( hMiniMap, hMiniCode);

        var hVisBox = Math.floor(hEditor * hMiniCode / hCode);

        // Calculate visBox height
        visBox.css('height', '' + hVisBox + 'px');

        // visBox moving
        visBox.css('top', Math.floor(currentEditor.getScrollPos().y * (hScrollBar - hVisBox) / (hCode - hEditor) ) + 'px');

        // Slide miniCode block
		if (hMiniCode  > hMiniMap) {
            var scrollPercent = (hMiniCode - hMiniMap) / (hCode - hEditor);
			miniCode.css('top', 0 - Math.floor(currentEditor.getScrollPos().y * scrollPercent) + 'px');
		}
	}

	function scrollTo(y)
	{
        var hVisBox = $('#wdMinimap #visible_box').height();
        var miniCode = $('#wdMinimap #mini_code');

        var hMiniCode = miniCode.height();
        var hScrollBar = Math.min( $('#wdMinimap').height(), (hMiniCode + parseInt(miniCode.css('padding-top')) + parseInt(miniCode.css('padding-bottom'))) / 4 );

        var hCode = $('#editor-holder .CodeMirror-sizer:visible').height();
        var hEditor = $('#editor-holder .CodeMirror:visible .CodeMirror-scroll').height();


        var adjustedY = y - hVisBox / 2 ;

        adjustedY *= hCode  / (hScrollBar - hVisBox/2);
        adjustedY = Math.floor(adjustedY);

        currentEditor.setScrollPos( currentEditor.getScrollPos.x, Math.max(adjustedY, 0) );
	}

	function mouseDown(e)
	{
		if (e.button === 0) {
			dragging = true;
			scrollTo(e.pageY);
		}
		else if (e.button === 2) {
			MinimapMenus.openContextMenu(e.clientX, e.clientY);
		}
	}

	function mouseMove(e)
	{
		if (dragging) {
			scrollTo(e.pageY);
			e.stopPropagation();
		}
	}

	function mouseUp()
	{
		dragging = false;
	}

	function editorResize()
	{
        var code = $('#editor-holder .CodeMirror-sizer:visible');
        var miniCode = $('#wdMinimap #mini_code');
        miniCode.css('width', code.width());

		editorScroll();
	}

	function setThemeColors()
	{
		var minimap = $('#wdMinimap');
		var editor = $('#editor-holder .CodeMirror:visible');

		if (editor.length == 0) return;

		var newTheme;
		var classList = editor.attr('class').split(/\s+/);
		$.each( classList, function(index, className){
			if (className.match(/^cm-s-.+/)) {
				newTheme = className;
				return false;
			}
		});

		if (newTheme !== currentTheme) {
			var miniCode = $('#wdMinimap #mini_code');

			miniCode.removeClass(currentTheme);
			miniCode.addClass(newTheme);
			currentTheme = newTheme;
			miniCode.css('color', editor.css('color'));

			documentSwitch();
		}

		//Sometimes when changing themes the background flashes to the default
		//color and the minimap picks it up, so we have to check it separately

//		if (minimap.css('backgroundColor') !== editor.css('backgroundColor')) {
//			var visBox = $('#wdMinimap #visible_box');
//
//			minimap.css('backgroundColor', editor.css('backgroundColor'));
//			var pos_neg = 1;
//			if (lightColor(minimap.css('backgroundColor'))) pos_neg = -1;
//			visBox.css('backgroundColor', shadeColor(minimap.css('backgroundColor'), pos_neg * 25));
//			minimap.css('borderLeftColor', shadeColor(minimap.css('backgroundColor'), pos_neg * 3));
//		}
	}

    function updateFont()
    {
        var miniMap = $('#wdMinimap #mini_code');
        var editor = $('#editor-holder .CodeMirror:visible .CodeMirror-scroll');

        miniMap.css("font-family", editor.css("font-family"));
    }

	//http://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color
	function shadeColor(color, percent)
	{
		color = color.replace(/#/,'');
		var num = parseInt(color,16),
		amt = Math.round(2.55 * percent),
		R = (num >> 16) + amt,
		B = (num >> 8 & 0x00FF) + amt,
		G = (num & 0x0000FF) + amt;
		return '#' + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (B<255?B<1?0:B:255)*0x100 + (G<255?G<1?0:G:255)).toString(16).slice(1);
	}

	function lightColor(color)
	{
		color = color.replace(/#/,'');
		var num = parseInt(color,16),
		R = (num >> 16),
		B = (num >> 8 & 0x00FF),
		G = (num & 0x0000FF);
		L = 0.2*R + 0.7*G + 0.1*B;
		return (L/255.0 > 0.5);
	}

//	$.cssHooks.backgroundColor = {
//		get: function(elem) {
//			if (elem.currentStyle)
//				var bg = elem.currentStyle["backgroundColor"];
//			else if (window.getComputedStyle)
//				var bg = document.defaultView.getComputedStyle(elem, null).getPropertyValue("background-color");
//
//			if (bg.search("rgb") == -1)
//				return bg;
//			else {
//				bg = bg.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
//				function hex(x) { return ("0" + parseInt(x).toString(16)).slice(-2); }
//				return "#" + hex(bg[1]) + hex(bg[2]) + hex(bg[3]);
//			}
//		}
//	}

	ExtensionUtils.loadStyleSheet(module, 'main.css');
	MinimapMenus.addToViewMenu();
	MinimapMenus.createContextMenu();

	$(MinimapMenus).on('showMinimap', enable);
	$(MinimapMenus).on('hideMinimap', disable);
	$(MinimapMenus).on('changedDisplayType', documentSwitch);

    if (PreferencesManager.get('enabled')) enable();
    if (MainViewManager.getWorkingSet().length == 0) hide();

});