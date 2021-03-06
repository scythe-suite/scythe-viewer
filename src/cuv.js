var results = [],
	infos = [],
	exercise_names = []; /* filled by from_json */

var $info, $uid, $exercise, $case,
	$score, $note, $sources, $cases, $summary,
	$sources_tab, $cases_tab, $summary_tab;

var MAX_NUM_LINES = 50;

var current = { 'uid': 0, 'exercise': 0 };

Mousetrap.bind( 'q', function() { update_uid( -1 ); } );
Mousetrap.bind( 'w', function() { update_summary(); } );
Mousetrap.bind( 'e', function() { update_uid( +1 ); } );

Mousetrap.bind( 'a', function() { update_exercise( -1 ); } );
Mousetrap.bind( 's', function() { update_exercise(); } );
Mousetrap.bind( 'd', function() { update_exercise( +1 ); } );

Mousetrap.bind( 'z', function() { update_case( -1 ); } );
Mousetrap.bind( 'x', function() { update_case(); } );
Mousetrap.bind( 'c', function() { update_case( +1 ); } );

Mousetrap.bind( 'h', function() { $( '#shortcuts' ).modal( 'toggle' ); } );
Mousetrap.bind( 'r', function() { $( 'div.progress' ).toggle(); $( 'span.badges' ).toggle(); } );

function input_ue( e ) {
	var $e = $( e );
	return {
		'uid': $e.closest( 'tr' ).data( 'uid' ),
		'exercise': $e.closest( 'td' ).data( 'exercise' )
	};
}

function update_case( delta ) {
	var cur = results[ current.uid ];
	if ( cur == null ) return;
	var cases = cur.exercises[ current.exercise ].cases;
	if ( cases.length == 0 ) return;
	if ( typeof delta !== 'undefined' ) {
		var t = current.case + delta;
		if ( 0 <= t && t < cases.length ) current.case = t;
		else return;
	}
	var cur = cases[ current.case ];
	$case.text( cur.name );
	var res = [];
	$.each( [ 'args', 'input', 'expected', 'actual', 'errors', 'diffs' ], function( i, e ) {
		if ( cur[ e ] === null ) return;
		var lines = cur[ e ].split( '\n' );
		var content = lines.length > MAX_NUM_LINES ? lines.slice( 0, MAX_NUM_LINES ).join( '\n' ) + '\n<<TRUNCATED>>\n': lines.join( '\n' );
		res.push(
			$( '<div/>' ).html(
				'<span class="label">' + e + '</span>'
			).append(
				current.case > 0 ?
					$( '<pre/>' ).html( hljs.highlight( 'diff', content ).value )
				:
					$( '<pre/>' ).text( content )
			)
		);
	} );
	if ( cur.errors != null || cur.diffs != null ) {
		if ( current.case > 0 )
			$cases.html( '<div class="alert alert-error">problems found</div>' );
		else
			$cases.html( '<div class="alert alert-info">compilation errors</div>' );
		$.each( res, function( i, r ) { $cases.append( r ); } );
	} else
		$cases.html( '<div class="alert alert-success">no problems found</div>' );
	$cases_tab.tab( 'show' );
}

function update_exercise( delta ) {
	var cur = results[ current.uid ];
	if ( cur == null ) return;
	var exercises = cur.exercises;
	if ( typeof delta !== 'undefined' ) {
		var t = current.exercise + delta;
		if ( 0 <= t && t < exercises.length ) current.exercise = t;
		else return;
	}
	cur = exercises[ current.exercise ];
	$exercise.text( cur.name );
	var res = [];
	$.each( cur.sources, function( idx, source ) {
		res.push( $( '<div/>' ).append(
			'<span class="label">' + source[ 'name' ] + '</span>'
		).append(
			$( '<pre/>' ).html( hljs.highlight( 'cpp', source[ 'content' ] ).value )
		) );
	} );
	if ( res.length > 0 ) {
		$sources.html( '' );
		$.each( res, function( i, s ) { $sources.append( s ); } );
	} else {
		$sources.html( '<div class="alert alert-error">no source file found</div>' );
	}
	current.case = 0;
	update_case();
	$sources_tab.tab( 'show' );
}

function update_uid( delta ) {
	if ( typeof delta !== 'undefined' ) {
		var t = current.uid + delta;
		if ( 0 <= t && t < results.length ) current.uid = t;
		else return;
	}
	var cur = results[ current.uid ];
	if ( cur == null ) return;
	$uid.text( cur.signature.uid );
	$info.val( cur.signature.info );
	$( 'tbody tr' ).removeClass( 'info' );
	$( 'tr[data-uid="' + current.uid + '"]' ).addClass( 'info' );
	update_exercise();
}

function update_summary() {
	$summary_tab.tab( 'show' );
}

function from_json( data ) {

	if ( typeof data === 'object' ) {
		results = data;
	} else {
		results = JSON.parse( data );
	}

	infos.splice( 0, infos.length ); /* mutate the object since it is bound to typeahead */
	exercise_names = {};
	$.each( results, function( ri, res ) {
		infos.push( res.signature.info );
		$.each( res.exercises, function( ei, ex ) {
			exercise_names[ ex.name ] = true;
		} );
	} );
	exercise_names = Object.keys( exercise_names ).sort();

	setup_summary();
	current = { uid: 0, exercise: 0 };
	update_uid();
	update_summary();
}

function setup_summary() {
	var thead = $( '<thead/>' );
	var tr = $( '<tr/>' );
	tr.append( $( '<th>UID</th><th>Info</th>' ) );
	$.each( exercise_names, function( i, name ) {
		tr.append( $( '<th class="sorter-result"/>' ).text( name ) );
	} );
	thead.append( tr );

	var tbody = $( '<tbody/>' );
	$.each( results, function( uid, res ) {
		if ( res.signature.uid === '000000' ) return; /* hack to exclude the test user */
		var tr = $( '<tr data-uid="'+ uid + '"/>');
		tr.append( $( '<td/>').text( res.signature.uid ) );
		tr.append( $( '<td/>').text( res.signature.info ) );
		var s = {};
		$.each( res.exercises, function( i, ex ) {
			var n = {
				'sources': Object.keys( ex.sources ).length,
				'errors': 0,
				'diffs': 0,
				'cases': ex.cases.length - 1
			};
			$.each( ex.cases.slice(1), function( i, cn ) {
				if ( cn.diffs != null ) n[ 'diffs' ] += 1;
				if ( cn.errors != null ) n[ 'errors' ] += 1;
			} );
			if ( n.sources > 0 ) n.ok = n.cases - n.diffs - n.errors;
			s[ ex.name ] = n;
		} );
		$.each( exercise_names, function( ex, name ) {
			var sn = s[ name ];
			var badges = $( '<span class="badges"/>' );
			var progress = $( '<div class="progress"/>' );
			function _badge( k, l0, l1 ) {
				var badge = null;
				if ( sn == null || sn[ k ] == 0 ) return null;
				badge = $( '<span class="badge badge' + ( l0 !== 'undefined' ? '-' + l0 : '' ) + '"/>' ).text( sn[ k ] );
				badges.append( badge );
				if ( typeof l1 !== 'undefined' )
					progress.append( $( '<div class="bar bar-' + l1 +'" style="width: ' + ( sn[ k ] * 100 / ( sn.cases - 1 ) ) +'%;"/>' ) );
				return badge;
			}
			var td = $( '<td data-exercise="' + ex + '"/>' );
			var source_badge = _badge( 'sources' );
			if ( source_badge !== null ) source_badge.click( function( e ) {
				current = input_ue( e.target );
				update_uid();
				$sources_tab.tab( 'show' );
			} );
			_badge( 'ok', 'success', 'success' );
			_badge( 'diffs', 'important', 'danger' );
			//_badge( 'errors', 'warning' );
			_badge( 'errors', 'info', 'info' );
			td.append( badges );
			td.append( progress );
			tr.append( td );
		} );
		tbody.append( tr );
	} );
	var table = $( '<table class="table table-bordered table-striped"/>' );
	table.append( thead );
	table.append( tbody );
	table.tablesorter({
		theme: 'bootstrap',
		headerTemplate : '{content} {icon}',
		widgets : [ "uitheme" ]
	} );
	$summary.html( table );
	$( 'div.progress' ).toggle();
	$( 'input.evals' ).toggle();
}

$( function() {

	$info = $( '#info' );
	$uid = $( '#uid' );
	$exercise = $( '#exercise' );
	$case = $( '#case' );

	$evaluation = $( '#evaluation' );
	$score = $( '#score' );
	$note = $( '#note' );
	$cases = $( '#cases' );
	$sources = $( '#sources' );
	$summary = $( '#summary' );

	$cases_tab = $( '#sections_nav a[href="#cases_tab"]' );
	$sources_tab = $( '#sections_nav a[href="#sources_tab"]' );
	$summary_tab= $( '#sections_nav a[href="#summary_tab"]' );

	$cases_tab.click( update_case );
	$sources_tab.click( update_exercise );
	$summary_tab.click( update_summary );

	$info.typeahead( { source: infos } );
	$info.on( "focus", function( e ) { $info.val( '' ); } );
	$info.on( "blur", function( e ) { if ( results[ current.uid ] != null ) $info.val( results[ current.uid ].signature.info ); } );
	$info.keypress( function( e ) {
		if ( e.which == 13 ) {
			var t = infos.indexOf( $info.val() );
			if ( t >= 0 ) {
				current.uid = t;
				update_uid();
			}
			$info.blur();
			e.preventDefault();
			return false;
		}
	} );

	$.tablesorter.addParser( {
		id: 'result',
		is: function( s ) { return false; },
		format: function( s, table, cell, cellIndex ) {
			return $( cell ).find( '[class*="badge-success"]' ).text();
		},
		type: 'numeric'
	} );


	$.getJSON( '../results.json', function( data ) {
		from_json( data );
		console.log( 'loaded results.json' );
	} ).fail( function() {
		console.log( 'missing data' );
	} );
// nope
} );
