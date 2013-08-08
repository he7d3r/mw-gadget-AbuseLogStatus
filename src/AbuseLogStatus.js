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
	'al-summary': 'Status do registro [[Especial:Registro de abusos/$1|$1]]: $2' +
		' (edição feita com [[Special:PermaLink/36600646#Script (experimental)|um script]])',
	'al-correct-template': '* {{Ação|$1}}\n',
	'al-problem-template': '* {{Ação|$1|erro=sim}}\n',
	'al-correct-template-with-note': '* {{Ação|$1|nota=$2}}\n',
	'al-problem-template-with-note': '* {{Ação|$1|erro=sim|nota=$2}}\n',
	'al-template-regex': '\\* *\\{\\{ *[Aa]ção *\\|[^\\}]*($1)[^\\}]*?\\}\\} *(?:\\n|$)',
	'al-empty-page': '{' + '{Lista de falsos positivos (cabeçalho)}}\n\n',
	'al-page-edit-success': '<p>A página <a href="$1">foi editada</a>.</p>',
	'al-page-edit-error': 'Houve um erro ao tentar editar. Por favor, tente novamente.',
	'al-log-false-positive': 'Um editor já identificou que este registro foi um falso positivo',
	'al-log-correct': 'Um editor já identificou que este registro estava correto',
	'al-header': 'Análise',
	'al-question': 'Este filtro deveria ter detectado esta ação?',
	'al-correct-description': 'Marcar este registro como correto',
	'al-yes': 'Sim',
	'al-correct': 'Correto',
	'al-incorrect-description': 'Marcar este registro como falso positivo',
	'al-no': 'Não',
	'al-incorrect': 'Falso positivo',
	'al-placeholder': 'Observação sobre esta ação (se precisar)',
	'al-submit': 'Enviar',
	'al-submit-description': 'Enviar a sua análise (editará automaticamente a página apropriada)'
} );

var filter, reTemplate, reDetailsPage, revision;

function onClick ( e ){
	var note, api,
		$button = $( e.target ),
		falsePositive = $( 'input[type="radio"]:checked' ).val() !== 'correct',
		defineStatus = function ( data ){
			var template, start,
				editParams = {
					action: 'edit',
					title: mw.msg( 'al-page-title', filter ),
					summary: mw.msg(
						'al-summary',
						revision,
						falsePositive ? mw.msg( 'al-incorrect' ) : mw.msg( 'al-correct' )
					),
					minor: true,
					watchlist: 'nochange',
					token: mw.user.tokens.get( 'editToken' )
				},
				missing = data.query.pages[ data.query.pageids[0] ].missing === '',
				text = missing
					? mw.msg( 'al-empty-page' )
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
			if ( !missing ){
				editParams.basetimestamp = data.query.pages[ data.query.pageids[0] ].revisions[0].timestamp;
			}
			editParams.text = text;
			api.post( editParams )
			.done( function( data ) {
				var link = mw.util.wikiGetlink( mw.msg( 'al-page-title', filter ) ) + '?diff=0';
				if ( data.edit && data.edit.result && data.edit.result === 'Success' ) {
					mw.notify( $( mw.msg( 'al-page-edit-success', link ) ), {
						autoHide: false,
						tag: 'status'
					} );
				} else {
					mw.notify( mw.msg( 'al-page-edit-error' ), {
						autoHide: false,
						tag: 'status'
					} );
				}
			} )
			.fail( function(){
				mw.notify( mw.msg( 'al-page-edit-error' ), {
					autoHide: false,
					tag: 'status'
				} );
			} )
			.always( function(){
				$.removeSpinner( 'af-status-spinner' );
				$button.removeAttr('disabled');
			} );
		},
		getPageContent = function (){
			api = new mw.Api();
			$( '#mw-content-text' ).find( 'fieldset p > span > a' ).each( function(){
				filter = $( this ).attr( 'href' ).match( /Especial:Filtro_de_abusos\/(\d+)$/ );
				if( filter && filter[1] ){
					filter = filter[1];
					return false;
				}
			} );
			$( '#al-submit' ).injectSpinner( 'af-status-spinner' );
			api.get( {
				prop: 'revisions',
				rvprop: 'content|timestamp',
				rvlimit: 1,
				indexpageids: true,
				titles: mw.msg( 'al-page-title', filter )
			} )
			.done( defineStatus )
			.fail( function () {
				$.removeSpinner( 'af-status-spinner' );
			} );
		};
	$button.attr( 'disabled', 'disabled' );
	note = $( '#al-note' ).val();
	mw.loader.using( [ 'mediawiki.api.edit', 'jquery.spinner' ], getPageContent );
}

function addAbuseFilterStatusLinks(){
	reTemplate = new RegExp( mw.msg( 'al-template-regex', revision ) );
	$( 'fieldset h3' ).first().before(
		$( '<h3>' ).text( mw.msg( 'al-header' ) ),
		$( '<p>' ).text( mw.msg( 'al-question' ) )
			.append(
				$( '<input>').attr( {
					'name': 'al-status',
					'id': 'al-status-correct',
					'type': 'radio',
					'value': 'correct'
				} ).prop( 'checked', true ),
				$( '<label>').attr( {
					'for': 'al-status-correct',
					'title': mw.msg( 'al-correct-description' )
				} ).text( mw.msg( 'al-yes' ) ),
				$( '<input>').attr( {
					'name': 'al-status',
					'id': 'al-status-incorrect',
					'type': 'radio',
					'value': 'incorrect'
				} ),
				$( '<label>').attr( {
					'for': 'al-status-incorrect',
					'title': mw.msg( 'al-incorrect-description' )
				} ).text( mw.msg( 'al-no' ) ),
				' ',
				$( '<input>').attr( {
					'type': 'text',
					'id': 'al-note',
					'placeholder': mw.msg( 'al-placeholder' ),
					'size': 50
				} ),
				$( '<input>').attr( {
					'type': 'submit',
					'value': mw.msg( 'al-submit' ),
					'id': 'al-submit',
					'title': mw.msg( 'al-submit-description' )
				} ).click( onClick )
			)
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
				if( !texts[ filter ] ){
					return false;
				}
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
							.attr( 'title', mw.msg( 'al-log-false-positive' ) );
					} else {
						$currentLi
							.addClass( 'af-log-correct' )
							.attr( 'title', mw.msg( 'al-log-correct' ) );
					}
				}
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
		geinamespace: 4,
		geilimit: 'max'
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
		mw.loader.using( [ 'mediawiki.api.edit' ], function(){
			$( getVerificationPages );
		});
	} else {
		revision = mw.config.get( 'wgPageName' ).match( reDetailsPage );
		if( revision && revision[1] ){
			revision = revision[1];
			$( addAbuseFilterStatusLinks );
		}
	}
}

}( mediaWiki, jQuery ) );