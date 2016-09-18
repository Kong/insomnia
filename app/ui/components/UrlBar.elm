port module UrlBar exposing (..)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (..)
import Html.App as App


--import Dropdown
-- APP


main : Program Model
main =
    App.programWithFlags
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }



-- MODEL


type alias Model =
    { url : String
    , method : String
    }


init : Model -> ( Model, Cmd Msg )
init flags =
    flags ! [ ready True ]



-- UPDATE


type Msg
    = NewModel Model
    | NewUrl String


port ready : Bool -> Cmd msg


port onSendRequest : Bool -> Cmd msg


port onUrlChange : String -> Cmd msg


port onMethodChange : String -> Cmd msg


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NewModel newModel ->
            -- NOTE: Don't replace the URL
            { newModel | url = model.url } ! []

        NewUrl url ->
            ( { model | url = url }, onUrlChange url )



-- SUBSCRIPTIONS


port replaceModel : (Model -> msg) -> Sub msg


subscriptions : Model -> Sub Msg
subscriptions model =
    replaceModel NewModel



-- VIEW


view : Model -> Html Msg
view model =
    let
        method =
            model.method

        url =
            model.url
    in
        div [ class "urlbar" ]
            [ div [ class "dropdown" ]
                [ button [ type' "button" ]
                    [ div [ class "tall" ]
                        [ span [] [ text method ]
                        , i [ class "fa fa-caret-down" ] []
                        ]
                    ]
                ]
            , input [ type' "text", value url, onInput NewUrl ] []
            ]
