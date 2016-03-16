import * as types from '../constants/ActionTypes'

export function addTodo (text) {
    return (dispatch, getState) => {
        dispatch(loadStart());

        setTimeout(() => {
            let id = Date.now();
            let completed = false;
            localStorage['todos'] = JSON.stringify(
                [...JSON.parse(localStorage['todos'] || '[]'), {
                    text: text,
                    id: id,
                    completed: completed
                }]
            );
            dispatch({type: types.ADD_TODO, text, id, completed});
            dispatch(loadStop());
        }, 300);
    };
}

export function loadTodos () {
    return (dispatch) => {
        dispatch(loadStart());
        setTimeout(() => {
            let todos = JSON.parse(localStorage['todos'] || '[]');
            dispatch({type: types.LOAD_TODOS, todos})
        }, 300);
    }
}

export function loadStart () {
    return {type: types.LOAD_START};
}

export function loadStop () {
    return {type: types.LOAD_STOP};
}

export function deleteTodo (id) {
    return (dispatch) => {
        dispatch(loadStart());
        setTimeout(() => {

            localStorage['todos'] = JSON.stringify(
                JSON.parse(localStorage['todos'] || '[]').filter(t => t.id !== id)
            );
            dispatch({type: types.DELETE_TODO, id});
            dispatch(loadStop());
        }, 300);
    }
}

export function editTodo (id, text) {
    return {type: types.EDIT_TODO, id, text};
}

export function completeTodo (id) {
    return {type: types.COMPLETE_TODO, id};
}

export function completeAll () {
    return {type: types.COMPLETE_ALL};
}

export function clearCompleted () {
    return {type: types.CLEAR_COMPLETED};
}