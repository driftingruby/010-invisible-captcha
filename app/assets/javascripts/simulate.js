// Cross-broswer implementation of text ranges and selections
// documentation: http://bililite.com/blog/2011/01/17/cross-browser-text-ranges-and-selections/
// Version: 1.1
// Copyright (c) 2010 Daniel Wachsstock
// MIT license:
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:

// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

(function(){

bililiteRange = function(el, debug){
  var ret;
  if (debug){
    ret = new NothingRange(); // Easier to force it to use the no-selection type than to try to find an old browser
  }else if (document.selection){
    // Internet Explorer
    ret = new IERange();
  }else if (window.getSelection && el.setSelectionRange){
    // Standards. Element is an input or textarea
    ret = new InputRange();
  }else if (window.getSelection){
    // Standards, with any other kind of element
    ret = new W3CRange();
  }else{
    // doesn't support selection
    ret = new NothingRange();
  }
  ret._el = el;
  ret._textProp = textProp(el);
  ret._bounds = [0, ret.length()];
  return ret;
};

function textProp(el){
  // returns the property that contains the text of the element
  if (typeof el.value != 'undefined') return 'value';
  if (typeof el.text != 'undefined') return 'text';
  if (typeof el.textContent != 'undefined') return 'textContent';
  return 'innerText';
}

// base class
function Range(){}
Range.prototype = {
  length: function() {
    return this._el[this._textProp].replace(/\r/g, '').length; // need to correct for IE's CrLf weirdness
  },
  bounds: function(s){
    if (s === 'all'){
      this._bounds = [0, this.length()];
    }else if (s === 'start'){
      this._bounds = [0, 0];
    }else if (s === 'end'){
      this._bounds = [this.length(), this.length()];
    }else if (s === 'selection'){
      this.bounds ('all'); // first select the whole thing for constraining
      this._bounds = this._nativeSelection();
    }else if (s){
      this._bounds = s; // don't error check now; the element may change at any moment, so constrain it when we need it.
    }else{
      var b = [
        Math.max(0, Math.min (this.length(), this._bounds[0])),
        Math.max(0, Math.min (this.length(), this._bounds[1]))
      ];
      return b; // need to constrain it to fit
    }
    return this; // allow for chaining
  },
  select: function(){
    this._nativeSelect(this._nativeRange(this.bounds()));
    return this; // allow for chaining
  },
  text: function(text, select){
    if (arguments.length){
      this._nativeSetText(text, this._nativeRange(this.bounds()));
      if (select == 'start'){
        this.bounds ([this._bounds[0], this._bounds[0]]);
        this.select();
      }else if (select == 'end'){
        this.bounds ([this._bounds[0]+text.length, this._bounds[0]+text.length]);
        this.select();
      }else if (select == 'all'){
        this.bounds ([this._bounds[0], this._bounds[0]+text.length]);
        this.select();
      }
      return this; // allow for chaining
    }else{
      return this._nativeGetText(this._nativeRange(this.bounds()));
    }
  },
  insertEOL: function (){
    this._nativeEOL();
    this._bounds = [this._bounds[0]+1, this._bounds[0]+1]; // move past the EOL marker
    return this;
  }
};


function IERange(){}
IERange.prototype = new Range();
IERange.prototype._nativeRange = function (bounds){
  var rng;
  if (this._el.tagName == 'INPUT'){
    // IE 8 is very inconsistent; textareas have createTextRange but it doesn't work
    rng = this._el.createTextRange();
  }else{
    rng = document.body.createTextRange ();
    rng.moveToElementText(this._el);
  }
  if (bounds){
    if (bounds[1] < 0) bounds[1] = 0; // IE tends to run elements out of bounds
    if (bounds[0] > this.length()) bounds[0] = this.length();
    if (bounds[1] < rng.text.replace(/\r/g, '').length){ // correct for IE's CrLf wierdness
      // block-display elements have an invisible, uncounted end of element marker, so we move an extra one and use the current length of the range
      rng.moveEnd ('character', -1);
      rng.moveEnd ('character', bounds[1]-rng.text.replace(/\r/g, '').length);
    }
    if (bounds[0] > 0) rng.moveStart('character', bounds[0]);
  }
  return rng;
};
IERange.prototype._nativeSelect = function (rng){
  rng.select();
};
IERange.prototype._nativeSelection = function (){
  // returns [start, end] for the selection constrained to be in element
  var rng = this._nativeRange(); // range of the element to constrain to
  var len = this.length();
  if (document.selection.type != 'Text') return [len, len]; // append to the end
  var sel = document.selection.createRange();
  try{
    return [
      iestart(sel, rng),
      ieend (sel, rng)
    ];
  }catch (e){
    // IE gets upset sometimes about comparing text to input elements, but the selections cannot overlap, so make a best guess
    return (sel.parentElement().sourceIndex < this._el.sourceIndex) ? [0,0] : [len, len];
  }
};
IERange.prototype._nativeGetText = function (rng){
  return rng.text.replace(/\r/g, ''); // correct for IE's CrLf weirdness
};
IERange.prototype._nativeSetText = function (text, rng){
  rng.text = text;
};
IERange.prototype._nativeEOL = function(){
  if (typeof this._el.value != 'undefined'){
    this.text('\n'); // for input and textarea, insert it straight
  }else{
    this._nativeRange(this.bounds()).pasteHTML('<br/>');
  }
};
// IE internals
function iestart(rng, constraint){
  // returns the position (in character) of the start of rng within constraint. If it's not in constraint, returns 0 if it's before, length if it's after
  var len = constraint.text.replace(/\r/g, '').length; // correct for IE's CrLf wierdness
  if (rng.compareEndPoints ('StartToStart', constraint) <= 0) return 0; // at or before the beginning
  if (rng.compareEndPoints ('StartToEnd', constraint) >= 0) return len;
  for (var i = 0; rng.compareEndPoints ('StartToStart', constraint) > 0; ++i, rng.moveStart('character', -1));
  return i;
}
function ieend (rng, constraint){
  // returns the position (in character) of the end of rng within constraint. If it's not in constraint, returns 0 if it's before, length if it's after
  var len = constraint.text.replace(/\r/g, '').length; // correct for IE's CrLf wierdness
  if (rng.compareEndPoints ('EndToEnd', constraint) >= 0) return len; // at or after the end
  if (rng.compareEndPoints ('EndToStart', constraint) <= 0) return 0;
  for (var i = 0; rng.compareEndPoints ('EndToStart', constraint) > 0; ++i, rng.moveEnd('character', -1));
  return i;
}

// an input element in a standards document. "Native Range" is just the bounds array
function InputRange(){}
InputRange.prototype = new Range();
InputRange.prototype._nativeRange = function(bounds) {
  return bounds || [0, this.length()];
};
InputRange.prototype._nativeSelect = function (rng){
  this._el.setSelectionRange(rng[0], rng[1]);
};
InputRange.prototype._nativeSelection = function(){
  return [this._el.selectionStart, this._el.selectionEnd];
};
InputRange.prototype._nativeGetText = function(rng){
  return this._el.value.substring(rng[0], rng[1]);
};
InputRange.prototype._nativeSetText = function(text, rng){
  var val = this._el.value;
  this._el.value = val.substring(0, rng[0]) + text + val.substring(rng[1]);
};
InputRange.prototype._nativeEOL = function(){
  this.text('\n');
};

function W3CRange(){}
W3CRange.prototype = new Range();
W3CRange.prototype._nativeRange = function (bounds){
  var rng = document.createRange();
  rng.selectNodeContents(this._el);
  if (bounds){
    w3cmoveBoundary (rng, bounds[0], true, this._el);
    rng.collapse (true);
    w3cmoveBoundary (rng, bounds[1]-bounds[0], false, this._el);
  }
  return rng;
};
W3CRange.prototype._nativeSelect = function (rng){
  window.getSelection().removeAllRanges();
  window.getSelection().addRange (rng);
};
W3CRange.prototype._nativeSelection = function (){
    // returns [start, end] for the selection constrained to be in element
    var rng = this._nativeRange(); // range of the element to constrain to
    if (window.getSelection().rangeCount == 0) return [this.length(), this.length()]; // append to the end
    var sel = window.getSelection().getRangeAt(0);
    return [
      w3cstart(sel, rng),
      w3cend (sel, rng)
    ];
  };
W3CRange.prototype._nativeGetText = function (rng){
  return rng.toString();
};
W3CRange.prototype._nativeSetText = function (text, rng){
  rng.deleteContents();
  rng.insertNode (document.createTextNode(text));
  this._el.normalize(); // merge the text with the surrounding text
};
W3CRange.prototype._nativeEOL = function(){
  var rng = this._nativeRange(this.bounds());
  rng.deleteContents();
  var br = document.createElement('br');
  br.setAttribute ('_moz_dirty', ''); // for Firefox
  rng.insertNode (br);
  rng.insertNode (document.createTextNode('\n'));
  rng.collapse (false);
};
// W3C internals
function nextnode (node, root){
  //  in-order traversal
  // we've already visited node, so get kids then siblings
  if (node.firstChild) return node.firstChild;
  if (node.nextSibling) return node.nextSibling;
  if (node===root) return null;
  while (node.parentNode){
    // get uncles
    node = node.parentNode;
    if (node == root) return null;
    if (node.nextSibling) return node.nextSibling;
  }
  return null;
}
function w3cmoveBoundary (rng, n, bStart, el){
  // move the boundary (bStart == true ? start : end) n characters forward, up to the end of element el. Forward only!
  // if the start is moved after the end, then an exception is raised
  if (n <= 0) return;
  var node = rng[bStart ? 'startContainer' : 'endContainer'];
  if (node.nodeType == 3){
    // we may be starting somewhere into the text
    n += rng[bStart ? 'startOffset' : 'endOffset'];
  }
  while (node){
    if (node.nodeType == 3){
      if (n <= node.nodeValue.length){
        rng[bStart ? 'setStart' : 'setEnd'](node, n);
        // special case: if we end next to a <br>, include that node.
        if (n == node.nodeValue.length){
          // skip past zero-length text nodes
          for (var next = nextnode (node, el); next && next.nodeType==3 && next.nodeValue.length == 0; next = nextnode(next, el)){
            rng[bStart ? 'setStartAfter' : 'setEndAfter'](next);
          }
          if (next && next.nodeType == 1 && next.nodeName == "BR") rng[bStart ? 'setStartAfter' : 'setEndAfter'](next);
        }
        return;
      }else{
        rng[bStart ? 'setStartAfter' : 'setEndAfter'](node); // skip past this one
        n -= node.nodeValue.length; // and eat these characters
      }
    }
    node = nextnode (node, el);
  }
}
var     START_TO_START                 = 0; // from the w3c definitions
var     START_TO_END                   = 1;
var     END_TO_END                     = 2;
var     END_TO_START                   = 3;
// from the Mozilla documentation, for range.compareBoundaryPoints(how, sourceRange)
// -1, 0, or 1, indicating whether the corresponding boundary-point of range is respectively before, equal to, or after the corresponding boundary-point of sourceRange.
    // * Range.END_TO_END compares the end boundary-point of sourceRange to the end boundary-point of range.
    // * Range.END_TO_START compares the end boundary-point of sourceRange to the start boundary-point of range.
    // * Range.START_TO_END compares the start boundary-point of sourceRange to the end boundary-point of range.
    // * Range.START_TO_START compares the start boundary-point of sourceRange to the start boundary-point of range.
function w3cstart(rng, constraint){
  if (rng.compareBoundaryPoints (START_TO_START, constraint) <= 0) return 0; // at or before the beginning
  if (rng.compareBoundaryPoints (END_TO_START, constraint) >= 0) return constraint.toString().length;
  rng = rng.cloneRange(); // don't change the original
  rng.setEnd (constraint.endContainer, constraint.endOffset); // they now end at the same place
  return constraint.toString().length - rng.toString().length;
}
function w3cend (rng, constraint){
  if (rng.compareBoundaryPoints (END_TO_END, constraint) >= 0) return constraint.toString().length; // at or after the end
  if (rng.compareBoundaryPoints (START_TO_END, constraint) <= 0) return 0;
  rng = rng.cloneRange(); // don't change the original
  rng.setStart (constraint.startContainer, constraint.startOffset); // they now start at the same place
  return rng.toString().length;
}

function NothingRange(){}
NothingRange.prototype = new Range();
NothingRange.prototype._nativeRange = function(bounds) {
  return bounds || [0,this.length()];
};
NothingRange.prototype._nativeSelect = function (rng){ // do nothing
};
NothingRange.prototype._nativeSelection = function(){
  return [0,0];
};
NothingRange.prototype._nativeGetText = function (rng){
  return this._el[this._textProp].substring(rng[0], rng[1]);
};
NothingRange.prototype._nativeSetText = function (text, rng){
  var val = this._el[this._textProp];
  this._el[this._textProp] = val.substring(0, rng[0]) + text + val.substring(rng[1]);
};
NothingRange.prototype._nativeEOL = function(){
  this.text('\n');
};

})();

 /*!
 * jQuery Simulate v0.0.1 - simulate browser mouse and keyboard events
 * https://github.com/jquery/jquery-simulate
 *
 * Copyright 2012 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * Date: Sun Dec 9 12:15:33 2012 -0500
 */

;(function( $, undefined ) {
  "use strict";

var rkeyEvent = /^key/,
  rmouseEvent = /^(?:mouse|contextmenu)|click/,
  rdocument = /\[object (?:HTML)?Document\]/;

function isDocument(ele) {
  return rdocument.test(Object.prototype.toString.call(ele));
}

function windowOfDocument(doc) {
  for (var i=0; i < window.frames.length; i+=1) {
    if (window.frames[i] && window.frames[i].document === doc) {
      return window.frames[i];
    }
  }
  return window;
}

$.fn.simulate = function( type, options ) {
  return this.each(function() {
    new $.simulate( this, type, options );
  });
};

$.simulate = function( elem, type, options ) {
  var method = $.camelCase( "simulate-" + type );

  this.target = elem;
  this.options = options || {};

  if ( this[ method ] ) {
    this[ method ]();
  } else {
    this.simulateEvent( elem, type, this.options );
  }
};

$.extend( $.simulate, {

  keyCode: {
    BACKSPACE: 8,
    COMMA: 188,
    DELETE: 46,
    DOWN: 40,
    END: 35,
    ENTER: 13,
    ESCAPE: 27,
    HOME: 36,
    LEFT: 37,
    NUMPAD_ADD: 107,
    NUMPAD_DECIMAL: 110,
    NUMPAD_DIVIDE: 111,
    NUMPAD_ENTER: 108,
    NUMPAD_MULTIPLY: 106,
    NUMPAD_SUBTRACT: 109,
    PAGE_DOWN: 34,
    PAGE_UP: 33,
    PERIOD: 190,
    RIGHT: 39,
    SPACE: 32,
    TAB: 9,
    UP: 38
  },

  buttonCode: {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2
  }
});

$.extend( $.simulate.prototype, {

  simulateEvent: function( elem, type, options ) {
    var event = this.createEvent( type, options );
    this.dispatchEvent( elem, type, event, options );
  },

  createEvent: function( type, options ) {
    if ( rkeyEvent.test( type ) ) {
      return this.keyEvent( type, options );
    }

    if ( rmouseEvent.test( type ) ) {
      return this.mouseEvent( type, options );
    }
  },

  mouseEvent: function( type, options ) {
    var event,
      eventDoc,
      doc = isDocument(this.target)? this.target : (this.target.ownerDocument || document),
      docEle,
      body;


    options = $.extend({
      bubbles: true,
      cancelable: (type !== "mousemove"),
      view: windowOfDocument(doc),
      detail: 0,
      screenX: 0,
      screenY: 0,
      clientX: 1,
      clientY: 1,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      button: 0,
      relatedTarget: undefined
    }, options );



    if ( doc.createEvent ) {
      event = doc.createEvent( "MouseEvents" );
      event.initMouseEvent( type, options.bubbles, options.cancelable,
        options.view, options.detail,
        options.screenX, options.screenY, options.clientX, options.clientY,
        options.ctrlKey, options.altKey, options.shiftKey, options.metaKey,
        options.button, options.relatedTarget || doc.body.parentNode );

      // IE 9+ creates events with pageX and pageY set to 0.
      // Trying to modify the properties throws an error,
      // so we define getters to return the correct values.
      if ( event.pageX === 0 && event.pageY === 0 && Object.defineProperty ) {
        eventDoc = isDocument(event.relatedTarget)? event.relatedTarget : (event.relatedTarget.ownerDocument || document);
        docEle = eventDoc.documentElement;
        body = eventDoc.body;

        Object.defineProperty( event, "pageX", {
          get: function() {
            return options.clientX +
              ( docEle && docEle.scrollLeft || body && body.scrollLeft || 0 ) -
              ( docEle && docEle.clientLeft || body && body.clientLeft || 0 );
          }
        });
        Object.defineProperty( event, "pageY", {
          get: function() {
            return options.clientY +
              ( docEle && docEle.scrollTop || body && body.scrollTop || 0 ) -
              ( docEle && docEle.clientTop || body && body.clientTop || 0 );
          }
        });
      }
    } else if ( doc.createEventObject ) {
      event = doc.createEventObject();
      $.extend( event, options );
      // standards event.button uses constants defined here: http://msdn.microsoft.com/en-us/library/ie/ff974877(v=vs.85).aspx
      // old IE event.button uses constants defined here: http://msdn.microsoft.com/en-us/library/ie/ms533544(v=vs.85).aspx
      // so we actually need to map the standard back to oldIE
      event.button = {
        0: 1,
        1: 4,
        2: 2
      }[ event.button ] || event.button;
    }

    return event;
  },

  keyEvent: function( type, options ) {
    var event, doc;
    options = $.extend({
      bubbles: true,
      cancelable: true,
      view: windowOfDocument(doc),
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      keyCode: 0,
      charCode: undefined
    }, options );

    doc = isDocument(this.target)? this.target : (this.target.ownerDocument || document);
    if ( doc.createEvent ) {
      try {
        event = doc.createEvent( "KeyEvents" );
        event.initKeyEvent( type, options.bubbles, options.cancelable, options.view,
          options.ctrlKey, options.altKey, options.shiftKey, options.metaKey,
          options.keyCode, options.charCode );
      // initKeyEvent throws an exception in WebKit
      // see: http://stackoverflow.com/questions/6406784/initkeyevent-keypress-only-works-in-firefox-need-a-cross-browser-solution
      // and also https://bugs.webkit.org/show_bug.cgi?id=13368
      // fall back to a generic event until we decide to implement initKeyboardEvent
      } catch( err ) {
        event = doc.createEvent( "Events" );
        event.initEvent( type, options.bubbles, options.cancelable );
        $.extend( event, {
          view: options.view,
          ctrlKey: options.ctrlKey,
          altKey: options.altKey,
          shiftKey: options.shiftKey,
          metaKey: options.metaKey,
          keyCode: options.keyCode,
          charCode: options.charCode
        });
      }
    } else if ( doc.createEventObject ) {
      event = doc.createEventObject();
      $.extend( event, options );
    }

    if ( !!/msie [\w.]+/.exec( navigator.userAgent.toLowerCase() ) || (({}).toString.call( window.opera ) === "[object Opera]") ) {
      event.keyCode = (options.charCode > 0) ? options.charCode : options.keyCode;
      event.charCode = undefined;
    }

    return event;
  },

  dispatchEvent: function( elem, type, event, options ) {
    if (options.jQueryTrigger === true) {
      $(elem).trigger($.extend({}, event, options, {type: type}));
    }
    else if ( elem.dispatchEvent ) {
      elem.dispatchEvent( event );
    } else if ( elem.fireEvent ) {
      elem.fireEvent( "on" + type, event );
    }
  },

  simulateFocus: function() {
    var focusinEvent,
      triggered = false,
      $element = $( this.target );

    function trigger() {
      triggered = true;
    }

    $element.bind( "focus", trigger );
    $element[ 0 ].focus();

    if ( !triggered ) {
      focusinEvent = $.Event( "focusin" );
      focusinEvent.preventDefault();
      $element.trigger( focusinEvent );
      $element.triggerHandler( "focus" );
    }
    $element.unbind( "focus", trigger );
  },

  simulateBlur: function() {
    var focusoutEvent,
      triggered = false,
      $element = $( this.target );

    function trigger() {
      triggered = true;
    }

    $element.bind( "blur", trigger );
    $element[ 0 ].blur();

    // blur events are async in IE
    setTimeout(function() {
      // IE won't let the blur occur if the window is inactive
      if ( $element[ 0 ].ownerDocument.activeElement === $element[ 0 ] ) {
        $element[ 0 ].ownerDocument.body.focus();
      }

      // Firefox won't trigger events if the window is inactive
      // IE doesn't trigger events if we had to manually focus the body
      if ( !triggered ) {
        focusoutEvent = $.Event( "focusout" );
        focusoutEvent.preventDefault();
        $element.trigger( focusoutEvent );
        $element.triggerHandler( "blur" );
      }
      $element.unbind( "blur", trigger );
    }, 1 );
  }
});



/** complex events **/

function findCenter( elem ) {
  var offset,
    $document,
    $elem = $( elem );

  if ( isDocument($elem[0]) ) {
    $document = $elem;
    offset = { left: 0, top: 0 };
  }
  else {
    $document = $( $elem[0].ownerDocument || document );
    offset = $elem.offset();
  }

  return {
    x: offset.left + $elem.outerWidth() / 2 - $document.scrollLeft(),
    y: offset.top + $elem.outerHeight() / 2 - $document.scrollTop()
  };
}

function findCorner( elem ) {
  var offset,
    $document,
    $elem = $( elem );

  if ( isDocument($elem[0]) ) {
    $document = $elem;
    offset = { left: 0, top: 0 };
  }
  else {
    $document = $( $elem[0].ownerDocument || document );
    offset = $elem.offset();
  }

  return {
    x: offset.left - document.scrollLeft(),
    y: offset.top - document.scrollTop()
  };
}

$.extend( $.simulate.prototype, {
  simulateDrag: function() {
    var i = 0,
      target = this.target,
      options = this.options,
      center = options.handle === "corner" ? findCorner( target ) : findCenter( target ),
      x = Math.floor( center.x ),
      y = Math.floor( center.y ),
      coord = { clientX: x, clientY: y },
      dx = options.dx || ( options.x !== undefined ? options.x - x : 0 ),
      dy = options.dy || ( options.y !== undefined ? options.y - y : 0 ),
      moves = options.moves || 3;

    this.simulateEvent( target, "mousedown", coord );

    for ( ; i < moves ; i++ ) {
      x += dx / moves;
      y += dy / moves;

      coord = {
        clientX: Math.round( x ),
        clientY: Math.round( y )
      };

      this.simulateEvent( target.ownerDocument, "mousemove", coord );
    }

    if ( $.contains( document, target ) ) {
      this.simulateEvent( target, "mouseup", coord );
      this.simulateEvent( target, "click", coord );
    } else {
      this.simulateEvent( document, "mouseup", coord );
    }
  }
});

})( jQuery );

/*jshint camelcase:true, plusplus:true, forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, browser:true, devel:true, maxerr:100, white:false, onevar:false */
/*global jQuery:true $:true bililiteRange:true */

/* jQuery Simulate Key-Sequence Plugin 1.3.0
 * http://github.com/j-ulrich/jquery-simulate-ext
 *
 * Copyright (c) 2014 Jochen Ulrich
 * Licensed under the MIT license (MIT-LICENSE.txt).
 *
 * The plugin is an extension and modification of the jQuery sendkeys plugin by Daniel Wachsstock.
 * Therefore, the original copyright notice and license follow below.
 */

// insert characters in a textarea or text input field
// special characters are enclosed in {}; use {{} for the { character itself
// documentation: http://bililite.com/blog/2008/08/20/the-fnsendkeys-plugin/
// Version: 2.0
// Copyright (c) 2010 Daniel Wachsstock
// MIT license:
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

;(function($, undefined){
  "use strict";

  $.simulate.prototype.quirks = $.simulate.prototype.quirks || {};

  $.extend($.simulate.prototype.quirks,

  /**
   * @lends $.simulate.prototype.quirks
   */
  {
    /**
     * When simulating with delay in non-input elements,
     * all spaces are simulated at the end of the sequence instead
     * of the correct position.
     * @see {@link https://github.com/j-ulrich/jquery-simulate-ext/issues/6|issues #6}
     */
    delayedSpacesInNonInputGlitchToEnd: undefined

  });

  $.extend($.simulate.prototype,

  /**
   * @lends $.simulate.prototype
   */
  {

    /**
     * Simulates sequencial key strokes.
     *
     * @see https://github.com/j-ulrich/jquery-simulate-ext/blob/master/doc/key-sequence.md
     * @public
     * @author Daniel Wachsstock, julrich
     * @since 1.0
     */
    simulateKeySequence: function() {
      var target = this.target,
        $target = $(target),
        opts = $.extend({
          sequence: "",
          triggerKeyEvents: true,
          eventProps: {},
          delay: 0,
          callback: undefined
        }, this.options),
        sequence = opts.sequence;

      opts.delay = parseInt(opts.delay,10);

      var localkeys = {};

      // Fix for #6 (https://github.com/j-ulrich/jquery-simulate-ext/issues/6)
      if ($.simulate.prototype.quirks.delayedSpacesInNonInputGlitchToEnd && !$target.is('input,textarea')) {
        $.extend(localkeys, {
          ' ': function(rng, s, opts) {
            var internalOpts = $.extend({}, opts, {
              triggerKeyEvents: false,
              delay: 0,
              callback: undefined
            });
            $.simulate.prototype.simulateKeySequence.defaults.simplechar(rng, '\xA0', internalOpts);
            $.simulate.prototype.simulateKeySequence.defaults['{leftarrow}'](rng, s, internalOpts);
            $.simulate.prototype.simulateKeySequence.defaults.simplechar(rng, s, opts);
            $.simulate.prototype.simulateKeySequence.defaults['{del}'](rng, s, internalOpts);
          }
        });
      }

      $.extend(localkeys, opts, $target.data('simulate-keySequence')); // allow for element-specific key functions

      // most elements to not keep track of their selection when they lose focus, so we have to do it for them
      var rng = $.data (target, 'simulate-keySequence.selection');
      if (!rng){
        rng = bililiteRange(target).bounds('selection');
        $.data(target, 'simulate-keySequence.selection', rng);
        $target.bind('mouseup.simulate-keySequence', function(){
          // we have to update the saved range. The routines here update the bounds with each press, but actual keypresses and mouseclicks do not
          $.data(target, 'simulate-keySequence.selection').bounds('selection');
        }).bind('keyup.simulate-keySequence', function(evt){
          // restore the selection if we got here with a tab (a click should select what was clicked on)
          if (evt.which === 9){
            // there's a flash of selection when we restore the focus, but I don't know how to avoid that.
            $.data(target, 'simulate-keySequence.selection').select();
          }else{
            $.data(target, 'simulate-keySequence.selection').bounds('selection');
          }
        });
      }
      $target.focus();
      if (typeof sequence === 'undefined') { // no string, so we just set up the event handlers
        return;
      }
      sequence = sequence.replace(/\n/g, '{enter}'); // turn line feeds into explicit break insertions

      /**
       * Informs the rest of the world that the sequences is finished.
       * @fires simulate-keySequence
       * @requires target
       * @requires sequence
       * @requires opts
       * @inner
       * @author julrich
       * @since 1.0
       */
      function sequenceFinished() {
        $target.trigger({type: 'simulate-keySequence', sequence: sequence});
        if ($.isFunction(opts.callback)) {
          opts.callback.apply(target, [{
            sequence: sequence
          }]);
        }
      }

      /**
       * Simulates the key stroke for one character (or special sequence) and sleeps for
       * <code>opts.delay</code> milliseconds.
       * @requires lastTime
       * @requires now()
       * @requires tokenRegExp
       * @requires opts
       * @requires rng
       * @inner
       * @author julrich
       * @since 1.0
       */
      function processNextToken() {
        var timeElapsed = now() - lastTime; // Work-around for Firefox "bug": setTimeout can fire before the timeout
        if (timeElapsed >= opts.delay) {
          var match = tokenRegExp.exec(sequence);
          if ( match !== null ) {
            var s = match[0];
            (localkeys[s] || $.simulate.prototype.simulateKeySequence.defaults[s] || $.simulate.prototype.simulateKeySequence.defaults.simplechar)(rng, s, opts);
            setTimeout(processNextToken, opts.delay);
          }
          else {
            sequenceFinished();
          }
          lastTime = now();
        }
        else {
          setTimeout(processNextToken, opts.delay - timeElapsed);
        }
      }

      if (!opts.delay || opts.delay <= 0) {
        // Run as fast as possible
        sequence.replace(/\{[^}]*\}|[^{]+/g, function(s){
          (localkeys[s] || $.simulate.prototype.simulateKeySequence.defaults[s] || $.simulate.prototype.simulateKeySequence.defaults.simplechar)(rng, s, opts);
        });
        sequenceFinished();
      }
      else {
        var tokenRegExp = /\{[^}]*\}|[^{]/g; // This matches curly bracket expressions or single characters
        var now = Date.now || function() { return new Date().getTime(); },
          lastTime = now();

        processNextToken();
      }

    }
  });

  $.extend($.simulate.prototype.simulateKeySequence.prototype,

  /**
   * @lends $.simulate.prototype.simulateKeySequence.prototype
   */
  {

      /**
       * Maps special character char codes to IE key codes (covers IE and Webkit)
       * @author julrich
       * @since 1.0
       */
      IEKeyCodeTable: {
        33: 49, // ! -> 1
        64: 50, // @ -> 2
        35: 51, // # -> 3
        36: 52, // $ -> 4
        37: 53, // % -> 5
        94: 54, // ^ -> 6
        38: 55, // & -> 7
        42: 56, // * -> 8
        40: 57, // ( -> 9
        41: 48, // ) -> 0

        59: 186,  // ; -> 186
        58: 186,  // : -> 186
        61: 187,  // = -> 187
        43: 187,  // + -> 187
        44: 188,  // , -> 188
        60: 188,  // < -> 188
        45: 189,  // - -> 189
        95: 189,  // _ -> 189
        46: 190,  // . -> 190
        62: 190,  // > -> 190
        47: 191,  // / -> 191
        63: 191,  // ? -> 191
        96: 192,  // ` -> 192
        126: 192, // ~ -> 192
        91: 219,  // [ -> 219
        123: 219, // { -> 219
        92: 220,  // \ -> 220
        124: 220, // | -> 220
        93: 221,  // ] -> 221
        125: 221, // } -> 221
        39: 222,  // ' -> 222
        34: 222   // " -> 222
      },

      /**
       * Tries to convert character codes to key codes.
       * @param {Numeric} character - A character code
       * @returns {Numeric} The key code corresponding to the given character code,
       * based on the key code table of InternetExplorer. If no corresponding key code
       * could be found (which will be the case for all special characters except the common
       * ones), the character code itself is returned. However, <code>keyCode === charCode</code>
       * does not imply that no key code was found because some key codes are identical to the
       * character codes (e.g. for uppercase characters).
       * @requires $.simulate.prototype.simulateKeySequence.prototype.IEKeyCodeTable
       * @see $.simulate.prototype.simulateKeySequence.prototype.IEKeyCodeTable
       * @author julrich
       * @since 1.0
       */
      charToKeyCode: function(character) {
        var specialKeyCodeTable = $.simulate.prototype.simulateKeySequence.prototype.IEKeyCodeTable;
        var charCode = character.charCodeAt(0);

        if (charCode >= 64 && charCode <= 90 || charCode >= 48 && charCode <= 57) {
          // A-Z and 0-9
          return charCode;
        }
        else if (charCode >= 97 && charCode <= 122) {
          // a-z -> A-Z
          return character.toUpperCase().charCodeAt(0);
        }
        else if (specialKeyCodeTable[charCode] !== undefined) {
          return specialKeyCodeTable[charCode];
        }
        else {
          return charCode;
        }
      }
  });

  // add the functions publicly so they can be overridden
  $.simulate.prototype.simulateKeySequence.defaults = {

    /**
     * Simulates key strokes of "normal" characters (i.e. non-special sequences).
     * @param {Object} rng - bililiteRange object of the simulation target element.
     * @param {String} s - String of (simple) characters to be simulated.
     * @param {Object} opts - The key-sequence options.
     * @author Daniel Wachsstock, julrich
     * @since 1.0
     */
    simplechar: function (rng, s, opts){
      rng.text(s, 'end');
      if (opts.triggerKeyEvents) {
        for (var i =0; i < s.length; i += 1){
          var charCode = s.charCodeAt(i);
          var keyCode = $.simulate.prototype.simulateKeySequence.prototype.charToKeyCode(s.charAt(i));
          // a bit of cheating: rng._el is the element associated with rng.
          $(rng._el).simulate('keydown', $.extend({}, opts.eventProps, {keyCode: keyCode}));
          $(rng._el).simulate('keypress', $.extend({}, opts.eventProps,{keyCode: charCode, which: charCode, charCode: charCode}));
          $(rng._el).simulate('keyup', $.extend({}, opts.eventProps, {keyCode: keyCode}));
        }
      }
    },

    /**
     * Simulates key strokes of a curly opening bracket.
     * @param {Object} rng - bililiteRange object of the simulation target element.
     * @param {String} s - Ignored.
     * @param {Object} opts - The key-sequence options.
     * @author Daniel Wachsstock, julrich
     * @since 1.0
     */
    '{{}': function (rng, s, opts){
      $.simulate.prototype.simulateKeySequence.defaults.simplechar(rng, '{', opts);
    },

    /**
     * Simulates hitting the enter button.
     * @param {Object} rng - bililiteRange object of the simulation target element.
     * @param {String} s - Ignored.
     * @param {Object} opts - The key-sequence options.
     * @author Daniel Wachsstock, julrich
     * @since 1.0
     */
    '{enter}': function (rng, s, opts){
      rng.insertEOL();
      rng.select();
      if (opts.triggerKeyEvents === true) {
        $(rng._el).simulate('keydown', $.extend({}, opts.eventProps, {keyCode: 13}));
        $(rng._el).simulate('keypress', $.extend({}, opts.eventProps, {keyCode: 13, which: 13, charCode: 13}));
        $(rng._el).simulate('keyup', $.extend({}, opts.eventProps, {keyCode: 13}));
      }
    },

    /**
     * Simulates hitting the backspace button.
     * @param {Object} rng - bililiteRange object of the simulation target element.
     * @param {String} s - Ignored.
     * @param {Object} opts - The key-sequence options.
     * @author Daniel Wachsstock, julrich
     * @since 1.0
     */
    '{backspace}': function (rng, s, opts){
      var b = rng.bounds();
      if (b[0] === b[1]) { rng.bounds([b[0]-1, b[0]]); } // no characters selected; it's just an insertion point. Remove the previous character
      rng.text('', 'end'); // delete the characters and update the selection
      if (opts.triggerKeyEvents === true) {
        $(rng._el).simulate('keydown', $.extend({}, opts.eventProps, {keyCode: 8}));
        $(rng._el).simulate('keyup', $.extend({}, opts.eventProps, {keyCode: 8}));
      }
    },

    /**
     * Simulates hitting the delete button.
     * @param {Object} rng - bililiteRange object of the simulation target element.
     * @param {String} s - Ignored.
     * @param {Object} opts - The key-sequence options.
     * @author Daniel Wachsstock, julrich
     * @since 1.0
     */
    '{del}': function (rng, s, opts){
      var b = rng.bounds();
      if (b[0] === b[1]) { rng.bounds([b[0], b[0]+1]); } // no characters selected; it's just an insertion point. Remove the next character
      rng.text('', 'end'); // delete the characters and update the selection
      if (opts.triggerKeyEvents === true) {
        $(rng._el).simulate('keydown', $.extend({}, opts.eventProps, {keyCode: 46}));
        $(rng._el).simulate('keyup', $.extend({}, opts.eventProps, {keyCode: 46}));
      }
    },

    /**
     * Simulates hitting the right arrow button.
     * @param {Object} rng - bililiteRange object of the simulation target element.
     * @param {String} s - Ignored.
     * @param {Object} opts - The key-sequence options.
     * @author Daniel Wachsstock, julrich
     * @since 1.0
     */
    '{rightarrow}':  function (rng, s, opts){
      var b = rng.bounds();
      if (b[0] === b[1]) { b[1] += 1; } // no characters selected; it's just an insertion point. Move to the right
      rng.bounds([b[1], b[1]]).select();
      if (opts.triggerKeyEvents === true) {
        $(rng._el).simulate('keydown', $.extend({}, opts.eventProps, {keyCode: 39}));
        $(rng._el).simulate('keyup', $.extend({}, opts.eventProps, {keyCode: 39}));
      }
    },

    /**
     * Simulates hitting the left arrow button.
     * @param {Object} rng - bililiteRange object of the simulation target element.
     * @param {String} s - Ignored.
     * @param {Object} opts - The key-sequence options.
     * @author Daniel Wachsstock, julrich
     * @since 1.0
     */
    '{leftarrow}': function (rng, s, opts){
      var b = rng.bounds();
      if (b[0] === b[1]) { b[0] -= 1; } // no characters selected; it's just an insertion point. Move to the left
      rng.bounds([b[0], b[0]]).select();
      if (opts.triggerKeyEvents === true) {
        $(rng._el).simulate('keydown', $.extend({}, opts.eventProps, {keyCode: 37}));
        $(rng._el).simulate('keyup', $.extend({}, opts.eventProps, {keyCode: 37}));
      }
    },

    /**
     * Selects all characters in the target element.
     * @param {Object} rng - bililiteRange object of the simulation target element.
     * @author Daniel Wachsstock, julrich
     * @since 1.0
     */
    '{selectall}' : function (rng){
      rng.bounds('all').select();
    }
  };




  //####### Quirk detection #######
  if ($.simulate.ext_disableQuirkDetection !== true) { // Fixes issue #9 (https://github.com/j-ulrich/jquery-simulate-ext/issues/9)
    $(document).ready(function() {
      // delayedSpacesInNonInputGlitchToEnd
      // See issues #6 (https://github.com/j-ulrich/jquery-simulate-ext/issues/6)
      /* Append a div to the document (bililiteRange needs the element to be in the document), simulate
       * a delayed sequence containing a space in the middle and check if the space moves to the end.
       */
      var $testDiv = $('<div/>').css({height: 1, width: 1, position: 'absolute', left: -1000, top: -1000}).appendTo('body');
      $testDiv.simulate('key-sequence', {sequence: '\xA0 \xA0', delay:1, callback: function() {
        $.simulate.prototype.quirks.delayedSpacesInNonInputGlitchToEnd = ($testDiv.text() === '\xA0\xA0 ');
        $testDiv.remove();
      }});
    });
  }

})(jQuery);
