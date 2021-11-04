module.exports = {
	name: 'Dark Colorblind',
	displayName: 'Dark Colorblind',
	theme: {
		background: {
			default:    '#21262D', 	// primary background color
			success:    '#0080FF', 	// POST request, 200 OK, parameter names
			notice:     '#E8F086', 	// SEND button, GET request
			warning:    '#A691AE', 	// PUT request
			danger:     '#CC5500', 	// DELETE request
			surprise:   '#FFC20A', 	// accent (Dashboard link, branch button, add plugin button)
			info:       '#58A6FF' 	// OPTIONS AND HEAD request
		},
		foreground: {
			default:     '#fff',    // primary font color
			success:     '#000', 	// secondary font color for success background
			notice:      '#000', 	// secondary font color for notice background
			warning:     '#fff', 	// secondary font color for warning background
			danger:      '#fff', 	// secondary font color for danger background
			surprise:    '#000', 	// secondary font color for surprise background
			info:        '#000' 	// secondary font color for info background
		},
		highlight: {
			default: '#D3D3D3'      // sidebar highlight color
		},
		styles: {
			appHeader: {
				foreground: {
					surprise:   '#000'      // branch button font color
				}
			},
			paneHeader: {
				foreground: {
					surprise:   '#000', 	// accent font color
					info:       '#000' 		// response font color
				}
			},
			editor: {
				foreground: {
					default:    '#000', 	// primary editor font color
					surprise:   '#000', 	// accent font color
					info:       '#000' 		// response font color
				}
			},
			dialog: {
				background: {
					default:    '#2E4052' 	// modal primary background color
				},
				foreground: {
					default:    '#fff' 	    // primary font color for modals
				}
			}
		}
	}
}
