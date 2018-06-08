/**
 * Adds two links on pages like [[Special:AbuseLog/123]] to mark log entries
 * as 'correct' or 'false positive'
 * (workaround for [[phab:T30213]]
 *
 * @author: Helder (https://github.com/he7d3r)
 * @license: CC BY-SA 3.0 <https://creativecommons.org/licenses/by-sa/3.0/>
 */
( function ( mw, $ ) {
	'use strict';

	/* Translatable strings */
	mw.messages.set( {
		'al-page-title': 'Wikipédia:Filtro_de_edições/Análise/Filtro_$1',
		'al-summary': 'Status do registro [[Special:AbuseLog/$1|$1]]: $2' +
			' (edição feita com [[Special:PermaLink/36666969#Scripts|um script]])',
		'al-correct-template': '*{' + '{Ação|$1}}\n',
		'al-problem-template': '*{' + '{Ação|$1|erro=sim}}\n',
		'al-correct-template-with-note': '*{' + '{Ação|$1|nota=$2}}\n',
		'al-problem-template-with-note': '*{' + '{Ação|$1|erro=sim|nota=$2}}\n',
		// Keep this synced with the regex from mw-gadget-AbuseFilterStats
		'al-template-regex': '\\* *\\{\\{ *[Aa]ção *\\|(?:.*?\\D)?($1)(?:\\D.*?)?\\}\\} *(?:\\n|$)',
		'al-analysis-page-regex': '^Wikipédia:Filtro de edições\\/Análise\\/Filtro (\\d+)$',
		'al-page-header': '{' + '{Lista de falsos positivos (cabeçalho)}}\n\n',
		'al-page-edit-success': '<p>A página <a href="$1">foi editada</a>.</p>',
		'al-page-edit-conflict': 'Foi detectado um conflito entre edições. Por favor, tente novamente.',
		'al-page-edit-error': 'Houve um erro ao tentar editar ($1). Por favor, tente novamente.',
		'al-page-edit-error-unknown': 'Houve um erro desconhecido ao tentar editar. Por favor, tente novamente.',
		'al-log-false-positive': 'Um editor já identificou que este registro foi um falso positivo',
		'al-log-correct': 'Um editor já identificou que este registro estava correto',
		'al-log-false-positive-note': 'Um editor já identificou que este registro foi um falso positivo: $1',
		'al-log-correct-note': 'Um editor já identificou que este registro estava correto: $1',
		'al-header': 'Análise',
		'al-question': 'Este filtro deveria ter detectado esta ação?',
		'al-specific-question': 'Foi correto classificar esta ação como "$1"?',
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

	var api, filter, reTemplate, revision,
		db = mw.config.get( 'wgDBname' ),
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

	function doEdit( params ) {
		api.post( params )
		.done( function ( data ) {
			var edit = data.edit,
				link;
			if ( edit && edit.result && edit.result === 'Success' ) {
				link = mw.util.getUrl( edit.title ) +
					'?diff=' + edit.newrevid;
				mw.notify( $( mw.msg( 'al-page-edit-success', link ) ), {
					autoHide: false,
					tag: 'status'
				} );
			} else {
				mw.notify( mw.msg( 'al-page-edit-error-unknown' ), {
					autoHide: false,
					tag: 'status'
				} );
			}
		} )
		.fail( function ( code ) {
			if ( code === 'editconflict' ) {
				mw.notify( mw.msg( 'al-page-edit-conflict' ), {
					autoHide: false,
					tag: 'status'
				} );
				return;
			}
			mw.notify( mw.msg( 'al-page-edit-error', code ), {
				autoHide: false,
				tag: 'status'
			} );
		} )
		.always( function () {
			$.removeSpinner( 'af-status-spinner' );
			$( '#al-submit' ).removeAttr( 'disabled' );
		} );
	}

	function onClick() {
		var note,
			falsePositive = $( 'input[type="radio"]:checked' ).val() !== 'correct',
			defineStatus = function ( data ) {
				var template, start, text, i,
					editParams = {
						action: 'edit',
						title: mw.msg( 'al-page-title', filter ),
						// section: filter,
						summary: mw.msg(
							'al-summary',
							revision,
							falsePositive ? mw.msg( 'al-incorrect' ) : mw.msg( 'al-correct' )
						),
						minor: true,
						watchlist: 'nochange',
						token: mw.user.tokens.get( 'editToken' )
					},
					page = data.query.pages[ data.query.pageids[ 0 ] ],
					isMissing = page.missing === '';
				if ( note ) {
					note = note.replace( /\|/g, '{{!}}' );
					template = falsePositive
						? mw.message( 'al-problem-template-with-note', revision, note ).plain()
						: mw.message( 'al-correct-template-with-note', revision, note ).plain();
				} else {
					template = falsePositive
						? mw.message( 'al-problem-template', revision ).plain()
						: mw.message( 'al-correct-template', revision ).plain();
				}
				if ( isMissing ) {
					text = mw.message( 'al-page-header' ).plain() + '\n' + template;
					editParams.text = text;
					doEdit( editParams );
				} else {
					text = page.revisions[ 0 ][ '*' ];
					text = text.replace( reTemplate, '' ) + '\n' + template;
					start = text.search( conf[ db ].reStart );
					text = text.substr( 0, start ).replace( /\n+$/g, '\n\n' ) +
						text.substr( start )
							.split( '\n' )
							.sort()
							.join( '\n' )
							.replace( /^\n+/g, '' )
					// TODO: remove these temporary hacks
					for ( i = 0; conf[ db ].cleanup && i < conf[ db ].cleanup.length; i++ ) {
						text = text.replace( conf[ db ].cleanup[ i ][ 0 ], conf[ db ].cleanup[ i ][ 1 ] )
					}
					editParams.basetimestamp = page.revisions[ 0 ].timestamp;
					editParams.starttimestamp = page.revisions[ 0 ].starttimestamp;
					editParams.text = text;
					doEdit( editParams );
				}
			},
			getPageContent = function () {
				$( '#mw-content-text' ).find( 'fieldset p > span > a' ).each( function () {
					filter = $( this ).attr( 'href' ).match( conf[ db ].reFilterLink );
					if ( filter && filter[ 1 ] ) {
						filter = filter[ 1 ];
						return false;
					}
				} );
				$( '#al-submit' ).injectSpinner( 'af-status-spinner' );
				api.get( {
					prop: 'info|revisions',
					rvprop: 'content|timestamp',
					intoken: 'edit',
					// rvsection: 0,
					rvlimit: 1,
					indexpageids: true,
					titles: mw.msg( 'al-page-title', filter )
				} )
				.done( defineStatus )
				.fail( function () {
					$.removeSpinner( 'af-status-spinner' );
				} );
			};
		$( '#al-submit' ).attr( 'disabled', 'disabled' );
		note = $( '#al-note' ).val();

		mw.loader.using( [
			'mediawiki.api',
			'jquery.spinner',
			'mediawiki.notify',
			'mediawiki.notification'
		], getPageContent );
	}

	function addAbuseFilterStatusLinks() {
		var desc = $( 'fieldset' ).find( 'p:first span:first' )
			.text().match( conf[ db ].reDesc );
		reTemplate = new RegExp( mw.message( 'al-template-regex', revision ).plain(), 'g' );
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

	if ( mw.config.get( 'wgCanonicalSpecialPageName' ) === 'AbuseLog'
		&& conf[ db ]
	) {
		$.when(
			mw.loader.using( 'mediawiki.api' ),
			$.ready
		).then( function () {
			var id = mw.config.get( 'wgPageName' ).match( conf[ db ].reDetailsPage );
			api = new mw.Api();
			if ( id && id[ 1 ] ) {
				revision = id[ 1 ];
				addAbuseFilterStatusLinks();
			} else {
				getVerificationPages();
			}
		} );
	}

}( mediaWiki, jQuery ) );
