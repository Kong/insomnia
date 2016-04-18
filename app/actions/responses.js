import * as types from '../constants/actionTypes'

export function update (response) {
  return {type: types.RESPONSE_UPDATE, response};
}

