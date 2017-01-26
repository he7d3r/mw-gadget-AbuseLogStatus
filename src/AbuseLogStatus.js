/**
 * Adds two links on pages like [[Special:AbuseLog/123]] to mark log entries as 'correct' or 'false positive'
 * (workaround for [[phab:T30213]]
 *
 * @author: Helder (https://github.com/he7d3r)
 * @license: CC BY-SA 3.0 <https://creativecommons.org/licenses/by-sa/3.0/>
 */
( function ( mw, $ ) {
	'use strict';

	/* Translatable strings */
	mw.messages.set( {
		// Keep this synced with the regex from mw-gadget-AbuseFilterStats
		'al-template-regex': '\\* *\\{\\{ *[Aa]ção *\\|(?:.*?\\D)?($1)(?:\\D.*?)?\\}\\} *(?:\\n|$)',
		'al-analysis-page-regex': '^Wikipédia:Filtro de edições\\/Análise\\/Filtro (\\d+)$',
		'al-save-success': '<p>A avaliação foi <a href="$1">gravada</a>.</p>',
		'al-save-error-login': '<p>Houve um erro desconhecido ao tentar gravar a avaliação.</p>',
		'al-save-error': '<p>Houve um erro ao tentar gravar a avaliação.' +
			' Certifique-se de que está registrado em "$1".</p>',
		'al-log-false-positive': 'Um editor já identificou que este registro foi um falso positivo',
		'al-log-correct': 'Um editor já identificou que este registro estava correto',
		'al-log-false-positive-note': 'Um editor já identificou que este registro foi um falso positivo: $1',
		'al-log-correct-note': 'Um editor já identificou que este registro estava correto: $1',
		'al-header': 'Análise',
		'al-question': 'Este filtro deveria ter detectado esta ação?',
		'al-specific-question': 'Foi correto classificar esta ação como "$1"?',
		'al-correct-description': 'Marcar este registro como correto',
		'al-yes': 'Sim',
		'al-incorrect-description': 'Marcar este registro como falso positivo',
		'al-no': 'Não',
		'al-placeholder': 'Observação sobre esta ação (se precisar)',
		'al-submit': 'Enviar',
		'al-submit-description': 'Enviar a sua análise (editará automaticamente a página apropriada)'
	} );

	var api, reTemplate,
		aflId,
		db = mw.config.get( 'wgDBname' ),
		labsUrl = 'https://tools.wmflabs.org/ptwikis/registro',
		loginUrl = 'https://tools.wmflabs.org/ptwikis/login',
		conf = {
			ptwiki: {
				header: 'Predefinição:Lista de falsos positivos (cabeçalho)',
				reDetailsPage: /Especial:Registro_de_abusos\/(\d+)$/,
				reFilterLink: /^\/wiki\/Especial:Filtro_de_abusos\/(\d+)$/,
				reDesc: /Descrição do filtro: (.+?) \(/,
				reStart: /^.*\{\{[Aa]ção/m,
				reNote: /nota *= *(.+?) *(?:\||\}\} *(?:\n|$))/,
				reError: /\| *erro *= *sim/,
				// TODO: remove these temporary hacks
				cleanup: [
					// Remove spaces between "*" and the template
					[ /(^|\n)\*\s+\{\{Ação/g, '$1*{' + '{Ação' ],
					// Remove duplicated items
					[ /(\* *\{\{ *Ação *\| *(\d+)\D.+\n)(\* *\{\{ *Ação *\| *\2\D.+\n)+/g, '$1' ]
				]
			}
		};

	function onClick() {
		var logEntry = {
				action: 'insert',
				type: 'teste'
				// id: aflId,
				// 0: false positive; 1: true positive
				// status: 0,
				// comment: 'some notes'
			},
			save = function () {
				$( '#al-submit' ).injectSpinner( 'af-status-spinner' );
				$.ajax( {
					url: labsUrl,
					dataType: 'jsonp',
					data: {
						action: 'insert',
						// FIXME: change to 'filtro'?
						type: 'teste',
						id: logEntry.id,
						status: logEntry.status,
						comment: logEntry.comment
					}
				} )
				.done( function ( data ) {
					console.log( data );
					if ( data.status === 'success' ) {
						mw.notify( $( mw.msg( 'al-save-success', labsUrl ) ), {
							autoHide: false,
							tag: 'status'
						} );
					} else {
						mw.notify( $( mw.msg( 'al-save-error' ) ), {
							autoHide: false,
							tag: 'status'
						} );
					}
				} )
				.fail( function ( data ) {
					console.log( data );
					mw.notify( $( mw.msg( 'al-save-error-login', loginUrl ) ), {
						autoHide: false,
						tag: 'status'
					} );
				} )
				.always( function () {
					$.removeSpinner( 'af-status-spinner' );
					$( '#al-submit' ).removeAttr( 'disabled' );
				} );
			};

		$( '#al-submit' ).attr( 'disabled', 'disabled' );

		// 0: The edit should not have triggered the filter (false positive)
		// 1: The edit should have triggered the filter (true positive)
		logEntry.status = $( 'input[type="radio"]:checked' ).val() === 'correct' ? 1 : 0;
		logEntry.comment = $( '#al-note' ).val();
		logEntry.id = aflId;

		mw.loader.using( [
			// 'mediawiki.api.edit',
			'jquery.spinner',
			'mediawiki.notify',
			'mediawiki.notification'
		], save );
	}

	function addAbuseFilterStatusLinks() {
		var desc = $( 'fieldset' ).find( 'p:first span:first' )
			.text().match( conf[ db ].reDesc );
		reTemplate = new RegExp( mw.message( 'al-template-regex', aflId ).plain(), 'g' );
		$( 'fieldset h3' ).first().before(
			$( '<h3>' ).text( mw.msg( 'al-header' ) ),
			$( '<p>' ).text(
					desc && desc[ 1 ] ?
						mw.msg( 'al-specific-question', desc[ 1 ] ) :
						mw.msg( 'al-question' )
				)
				.append(
					$( '<br />' ),
					$( '<input>' ).attr( {
						name: 'al-status',
						id: 'al-status-correct',
						type: 'radio',
						value: 'correct'
					} ).prop( 'checked', true ),
					$( '<label>' ).attr( {
						'for': 'al-status-correct',
						title: mw.msg( 'al-correct-description' )
					} ).text( mw.msg( 'al-yes' ) ),
					$( '<input>' ).attr( {
						name: 'al-status',
						id: 'al-status-incorrect',
						type: 'radio',
						value: 'incorrect'
					} ),
					$( '<label>' ).attr( {
						'for': 'al-status-incorrect',
						title: mw.msg( 'al-incorrect-description' )
					} ).text( mw.msg( 'al-no' ) ),
					' ',
					$( '<input>' ).attr( {
						type: 'text',
						id: 'al-note',
						placeholder: mw.msg( 'al-placeholder' ),
						size: 50
					} ),
					$( '<input>' ).attr( {
						type: 'submit',
						value: mw.msg( 'al-submit' ),
						id: 'al-submit',
						title: mw.msg( 'al-submit-description' )
					} ).click( onClick )
				)
		);
	}
	function markAbuseFilterEntriesByStatus( texts ) {
		mw.util.addCSS(
			'.af-log-false-positive { background: #FDD; } ' +
			'.af-log-correct { background: #DFD; }'
		);
		$( '#mw-content-text' ).find( 'li' ).each( function () {
			var filter, log, $currentLi = $( this );
			$currentLi.find( 'a' ).each( function () {
				var href = $( this ).attr( 'href' ),
					match = href.match( conf[ db ].reFilterLink ),
					note;
				if ( match ) {
					filter = match[ 1 ];
					if ( !texts[ filter ] ) {
						return false;
					}
				} else {
					match = href.match( conf[ db ].reDetailsPage );
					if ( match && match[ 1 ] ) {
						log = match[ 1 ];
					}
				}
				if ( log && filter ) {
					reTemplate = new RegExp( mw.message( 'al-template-regex', log ).plain(), 'g' );
					match = texts[ filter ].match( reTemplate );
					if ( match ) {
						note = match[ 0 ].match( conf[ db ].reNote );
						// Highlight log entries already checked
						if ( conf[ db ].reError.test( match[ 0 ] ) ) {
							// add af-false-positive class
							$currentLi
								.addClass( 'af-log-false-positive' )
								.attr(
									'title',
									note ? mw.msg( 'al-log-false-positive-note', mw.html.escape( note[ 1 ] ) )
										: mw.msg( 'al-log-false-positive' )
								);
						} else {
							$currentLi
								.addClass( 'af-log-correct' )
								.attr(
									'title',
									note ? mw.msg( 'al-log-correct-note', mw.html.escape( note[ 1 ] ) )
										: mw.msg( 'al-log-correct' )
								);
						}
					}
					return false;
				}
			} );
		} );
	}

	function getVerificationPages() {
		var statusTexts = {},
			pageids;
		api.get( {
			action: 'query',
			list: 'embeddedin',
			eititle: conf[ db ].header,
			einamespace: 4,
			eifilterredir: 'nonredirects',
			eilimit: 'max'
		} )
		.done( function ( data ) {
			var filterPageToGet = {},
				i, filter,
				reAnalysisPage = new RegExp( mw.message( 'al-analysis-page-regex' ).plain() );
			$( '#mw-content-text' ).find( 'li' ).each( function () {
				$( this ).find( 'a' ).each( function () {
					var filter = $( this ).attr( 'href' ).match( conf[ db ].reFilterLink );
					if ( filter && !filterPageToGet[ filter[ 1 ] ] ) {
						filterPageToGet[ filter[ 1 ] ] = true;
						return false;
					}
				} );
			} );
			for ( i = 0; i < data.query.embeddedin.length; i++ ) {
				filter = data.query.embeddedin[ i ].title.match( reAnalysisPage );
				if ( filter && filterPageToGet[ filter[ 1 ] ] ) {
					filterPageToGet[ filter[ 1 ] ] = data.query.embeddedin[ i ].pageid;
				}
			}
			pageids = $.map( filterPageToGet, function ( id ) {
				return id !== true ? id : null;
			} ).join( '|' );
			if ( pageids === '' ) {
				return;
			}
			api.get( {
				action: 'query',
				prop: 'revisions',
				rvprop: 'content',
				pageids: pageids
				// generator: 'embeddedin',
				// geititle: conf[ db ].header,
				// geinamespace: 4,
				// geilimit: 'max'
			} )
			.done( function ( data ) {
				$.each( data.query.pages, function ( id ) {
					var filter,
						pg = data.query.pages[ id ];
					if ( pg.missing !== '' ) {
						filter = pg.title.match( reAnalysisPage );
						if ( filter && filter[ 1 ] ) {
							statusTexts[ filter[ 1 ] ] = pg.revisions[ 0 ][ '*' ];
						}
					}
				} );
				markAbuseFilterEntriesByStatus( statusTexts );
			} );
		} );
	}

	if ( mw.config.get( 'wgCanonicalSpecialPageName' ) === 'AbuseLog' && conf[ db ]
	) {
		$.when(
			mw.loader.using( 'mediawiki.api' ),
			$.ready
		).then( function () {
			var id = mw.config.get( 'wgPageName' ).match( conf[ db ].reDetailsPage );
			api = new mw.Api();
			if ( id && id[ 1 ] ) {
				aflId = id[ 1 ];
				addAbuseFilterStatusLinks();
			} else {
				getVerificationPages();
			}
		} );
	}

}( mediaWiki, jQuery ) );
