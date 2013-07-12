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
		' (edição feita com [[Special:PermaLink/36362748#Script (experimental)|um script]])',
	'al-correct-template': '* {{Ação|$1}}\n',
	'al-problem-template': '* {{Ação|$1|erro=sim}}\n',
	'al-correct-template-with-note': '* {{Ação|$1|nota=$2}}\n',
	'al-problem-template-with-note': '* {{Ação|$1|erro=sim|nota=$2}}\n',
	'al-template-regex': '\\* *\\{\\{ *[Aa]ção *\\|[^\\}]*($1)[^\\}]*?\\}\\} *(?:\\n|$)'
} );

var $links, filter, reTemplate, reDetailsPage, revision;

function onClick ( e ){
	var note,
		statusTexts = $( e.target ).text(),
		falsePositive = statusTexts === mw.msg( 'al-problem-text' ),
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
				summary: mw.msg( 'al-summary', revision, statusTexts ),
				minor: true,
				watchlist: 'nochange',
				token: mw.user.tokens.get( 'editToken' )
			} )
			.done( function( data ) {
				var link = mw.util.wikiGetlink( mw.msg( 'al-page-title', filter ) ) + '?diff=0';
				if ( data.edit && data.edit.result && data.edit.result === 'Success' ) {
					mw.notify(
						$( '<p>' ).append(
							'A página ',
							$( '<a>' )
								.attr( 'href', link )
								.text( 'foi editada' ),
							'.'
						)
					);
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
			.fail( function () {
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
	reTemplate = new RegExp( mw.msg( 'al-template-regex', revision ) );
	$link = $links.filter( function(){
		return reDetailsPage.test( $( this ).attr( 'href' ) );
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
function markAbuseFilterEntriesByStatus( texts ){
	var reFilterLink = /\/Especial:Filtro_de_abusos\/(\d+)/;
	mw.util.addCSS(
		'.af-log-false-positive { background: #FDD; } ' +
		'.af-log-correct { background: #DFD; }'
	);
	$( '#mw-content-text' ).find( 'li' ).each( function(){
		var filter, log, $currentLi = $( this );
		$currentLi.find( 'a' ).each( function(){
			var href = $( this ).attr( 'href' ),
				match = href.match( reFilterLink );
			if( match && match[1] ){
				filter = match[1];
			} else {
				match = href.match( reDetailsPage );
				if( match && match[1] ){
					log = match[1];
				}
			}
			if( log && filter ){
				reTemplate = new RegExp( mw.msg( 'al-template-regex', log ) );
				match = texts[ filter ].match( reTemplate );
				if( match && match[0] ){
					// Highlight log entries already checked
					if( /\| *erro *= *sim/.test( match[0] ) ){
						// add af-false-positive class
						$currentLi
							.addClass( 'af-log-false-positive' )
							.attr( 'title', 'Um editor já identificou que este registro foi um falso positivo' );
					} else {
						$currentLi
							.addClass( 'af-log-correct' )
							.attr( 'title', 'Um editor já identificou que este registro estava correto' );
					}
				}
				
				// stop the loop
				return false;
			}
		} ).first().attr( 'href' );
	} );
}

function getVerificationPages(){
	var statusTexts = {};
	( new mw.Api() ).get( {
		action: 'query',
		prop: 'revisions',
		rvprop: 'content',
		generator: 'embeddedin',
		geititle: 'Predefinição:Lista de falsos positivos (cabeçalho)',
		geinamespace: 4
		// geilimit: 10,
	} )
	.done( function ( data ) {
		$.each( data.query.pages, function(id){
			var filter = data.query.pages[ id ].title.match( /\d+$/ );
			if( filter && filter[0] ){
				statusTexts[ filter[0] ] = data.query.pages[ id ].revisions[0]['*'];
			}
		} );
		markAbuseFilterEntriesByStatus( statusTexts );
	} );
}

if ( mw.config.get( 'wgCanonicalSpecialPageName' ) === 'AbuseLog'
	&& mw.config.get( 'wgDBname' ) === 'ptwiki'
) {
	reDetailsPage = /Especial:Registro_de_abusos\/(\d+)$/;
	if ( mw.config.get( 'wgTitle' ) === 'Registro de abusos' ){
		$( getVerificationPages );
	} else {
		revision = mw.config.get( 'wgPageName' ).match( reDetailsPage );
		if( revision && revision[1] ){
			revision = revision[1];
			$( addAbuseFilterStatusLinks );
		}
	}
}

}( mediaWiki, jQuery ) );