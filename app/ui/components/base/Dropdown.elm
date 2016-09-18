port module Dropdown exposing (..)

import Html exposing (..)
import Html.Attributes exposing (..)


-- MODEL


type alias Model =
    { items : List DropdownItem
    , open : Bool
    }


type DropdownItem
    = Divider ItemModel
    | Item DividerModel


type alias ItemModel =
    { text : String
    , icon : Maybe String
    , id : String
    }


type alias DividerModel =
    { text : String
    }



-- UPDATE


type Msg
    = OnClick String


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        OnClick id ->
            model ! []



-- VIEW


view : Model -> Html Msg
view model =
    let
        classes =
            "dropdown"

        items =
            List.map buildItem model.items
    in
        div [ class classes ]
            items


buildItem itemModel =
    let
        item =
            div [] [ text "item" ]
    in
        item
