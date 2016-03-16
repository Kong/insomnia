import * as types from '../constants/ActionTypes';

function request (state, action) {
    switch (action.type) {
        case types.ADD_REQUEST:
            return {
                foo: 'bar'
            };

        default:
            return state;
    }
}

export default function requests (state = [], action) {
    switch (action.type) {
        case types.ADD_REQUEST:
            return [...state, request(undefined, action)];
        default:
            return state;
    }
}
