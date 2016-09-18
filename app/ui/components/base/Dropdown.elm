port module Base.Dropdown exposing (..)

import String exposing (join)
import Html exposing (..)
import Html.Attributes exposing (class)
import Html.Events exposing (onClick)


-- MODEL


type alias Model =
    { items : List ItemModel
    , open : Bool
    , up : Bool
    , right : Bool
    , outline : Bool
    , button :
        { text : String
        , class : String
        }
    }


type alias ItemModel =
    { text : String
    , icon : Maybe String
    , value : String
    , class : String
    }


init =
    { items = []
    , open = False
    , up = False
    , right = False
    , outline = False
    , button =
        { text = ""
        , class = ""
        }
    }



-- UPDATE


type Msg
    = ToggleDropdown
    | ItemClicked ItemModel


type Action
    = NoOp
    | OnClick String


update : Msg -> Model -> ( Model, Action )
update msg model =
    case msg of
        ToggleDropdown ->
            ( { model | open = not model.open }, NoOp )

        ItemClicked item ->
            ( { model | open = False }, OnClick item.value )


updateButtonText model text =
    let
        button =
            model.button

        newButton =
            { button | text = text }
    in
        { model | button = newButton }



-- VIEW


view : Model -> Html Msg
view model =
    let
        choose condition first =
            if condition then
                first
            else
                ""

        classes =
            join " "
                [ "dropdown"
                , choose model.open "dropdown--open"
                , choose model.right "dropdown--right"
                , choose model.up "dropdown--up"
                , choose model.outline "dropdown--outlined"
                ]

        items =
            List.map viewItem model.items
    in
        div [ class classes ]
            [ button [ onClick ToggleDropdown ]
                [ text model.button.text
                , i [ class "fa fa-caret-down" ] []
                ]
            , ul []
                items
            , div [ class "dropdown__backdrop", onClick ToggleDropdown ] []
            ]


viewItem : ItemModel -> Html Msg
viewItem item =
    let
        icon =
            case item.icon of
                Nothing ->
                    text ""

                Just cls ->
                    i [ class ("fa fa-" ++ cls) ] []
    in
        li []
            [ button [ onClick <| ItemClicked item ]
                [ div [ class <| "dropdown__inner " ++ item.class ]
                    [ icon
                    , span [ class "dropdown__text" ] [ text item.text ]
                    ]
                ]
            ]
