/**
 * Adds two links on pages like [[Special:AbuseLog/123]] to mark log entries as 'correct' or 'false positive'
 * (workaround for [[bugzilla:28213]]
 * @author: [[User:Helder.wiki]]
 * @tracking: [[Special:GlobalUsage/User:Helder.wiki/Tools/AbuseLogStatus.js]] ([[File:User:Helder.wiki/Tools/AbuseLogStatus.js]])
 */
/*jshint browser: true, camelcase: true, curly: true, eqeqeq: true, immed: true, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, quotmark: true, undef: true, unused: true, strict: true, trailing: true, maxlen: 120, laxbreak: true, devel: true, evil: true, onevar: true */
/*global jQuery, mediaWiki */
( function ( mw, $ ) {
'use strict';

/* Translatable strings */
mw.messages.set( {
	'al-page-title': 'Wikipédia:Filtro_de_edições/Falsos_positivos/Filtro_$1',
	'al-correct-text': 'correto',
	'al-problem-text': 'falso positivo',
	'al-note-description': 'Se precisar inserir uma observação sobre este registro,' +
		' digite-a abaixo e pressione "OK". Caso contrário, escolhar "Cancelar"',
	'al-correct-description': 'Marcar este registro como correto',
	'al-problem-description': 'Marcar este registro como falso positivo',
	'al-summary': 'Status do registro [[Especial:Registro de abusos/$1|$1]]: $2' +
		' (edição feita com [[WP:Filtro de edições/Falsos positivos#Script (experimental)|um script]])',
	'al-correct-template': '* {{Ação|$1}}\n',
	'al-problem-template': '* {{Ação|$1|erro=sim}}\n',
	'al-correct-template-with-note': '* {{Ação|$1|nota=$2}}\n',
	'al-problem-template-with-note': '* {{Ação|$1|erro=sim|nota=$2}}\n',
	'al-template-regex': '\\* *\\{\\{ *[Aa]ção *\\|[^ \\}]*($1)[^ \\}]*?\\}\\} *(?:\\n|$)'
} );

var $links, filter, reTemplate,
	reDetailsLink = new RegExp( '/' + $.escapeRE( mw.config.get( 'wgPageName' ) ) + '$' ),
	revision = mw.config.get( 'wgPageName' ).match( /\/(\d+)$/ );
	
function onClick ( e ){
	var note,
		statusText = $( e.target ).text(),
		falsePositive = statusText === mw.msg( 'al-problem-text' ),
		defineStatus = function ( data ){
			var template, start,
				text = data.query.pages[ data.query.pageids[0] ].missing === ''
					? '{' + '{Lista de falsos positivos (cabeçalho)}}\n\n'
					: data.query.pages[ data.query.pageids[0] ].revisions[0]['*'];
			if ( !note ){
				template = falsePositive
					? mw.msg( 'al-problem-template', revision )
					: mw.msg( 'al-correct-template', revision );
			} else {
				template = falsePositive
					? mw.msg( 'al-problem-template-with-note', revision, note )
					: mw.msg( 'al-correct-template-with-note', revision, note );
			}
			if( !reTemplate.test( text ) ) {
				text += '\n' + template;
			} else {
				text = text.replace( reTemplate, template );
			}
			start = text.search( /^.*\{\{[Aa]ção/m );
			text = text.substr( 0, start ).replace( /\n+$/g, '\n\n' ) +
				text.substr( start )
					.split( '\n' )
					.sort()
					.join( '\n' )
					.replace( /^\n+/g, '' )
					// TODO: remove this temporary hack
					.replace( /\| *nota *= *,/g, '|nota=' );
			( new mw.Api() ).post( {
				action: 'edit',
				title: mw.msg( 'al-page-title', filter ),
				text: text,
				summary: mw.msg( 'al-summary', revision, statusText ),
				minor: true,
				watchlist: 'nochange',
				token: mw.user.tokens.get( 'editToken' )
			} )
			.done( function( data ) {
				if ( data && data.edit && data.edit.result && data.edit.result === 'Success' ) {
					mw.notify( 'A página foi editada.' );
				} else {
					mw.notify( 'Houve um erro ao tentar editar' );
				}
			} ).always( function(){
				$.removeSpinner( 'af-status-spinner' );
			} );
		},
		getPageContent = function (){
			$links.each( function(){
				filter = $( this ).attr( 'href' ).match( /Especial:Filtro_de_abusos\/(\d+)$/ );
				if( filter && filter[1] ){
					filter = filter[1];
					return false;
				}
			} );
			$( '#firstHeading' ).injectSpinner( 'af-status-spinner' );
			( new mw.Api() ).get( {
				prop: 'revisions',
				rvprop: 'content',
				rvlimit: 1,
				indexpageids: true,
				titles: mw.msg( 'al-page-title', filter )
			} )
			.done( defineStatus )
			.fail( function ( data ) {
				mw.log( 'Error:', data.query );
				$.removeSpinner( 'af-status-spinner' );
			} );
		};
	e.preventDefault();
	note = prompt( mw.msg( 'al-note-description' ) );
	mw.loader.using( [ 'mediawiki.api.edit', 'jquery.spinner' ], getPageContent );
}

function addAbuseFilterStatusLinks(){
	var $link;
	$links = $( '#mw-content-text' ).find( 'fieldset p > span > a' );
	$link = $links.filter( function(){
		return reDetailsLink.test( $( this ).attr( 'href' ) );
	} ).first();
	$link.parent().append(
		' (',
		$link.clone()
			.text( mw.msg( 'al-correct-text' ) )
			.attr( {
				'href': '#',
				'title': mw.msg( 'al-correct-description' )
			} )
			.click( onClick ),
		' | ',
		$link.clone()
			.text( mw.msg( 'al-problem-text' ) )
			.attr( {
				'href': '#',
				'title': mw.msg( 'al-problem-description' )
			} )
			.click( onClick ),
		')'
	);
}

if ( mw.config.get( 'wgDBname' ) === 'ptwiki'
	&& mw.config.get( 'wgCanonicalSpecialPageName' ) === 'AbuseLog'
	&& revision
	&& revision[1]
) {
	revision = revision[1];
	reTemplate = new RegExp( mw.msg( 'al-template-regex', revision ) );
	$( addAbuseFilterStatusLinks );
}

}( mediaWiki, jQuery ) );