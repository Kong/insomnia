port module ResponsePaneHeader exposing (..)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.App as App
import TimeTag exposing (..)
import SizeTag exposing (..)
import StatusTag exposing (..)


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
    { statusCode : Int
    , statusMessage : String
    , statusDescription : String
    , elapsedTime : Int
    , bytesRead : Int
    }


init : Model -> ( Model, Cmd Msg )
init flags =
    flags ! []



-- UPDATE


type Msg
    = NewModel Model


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NewModel newModel ->
            newModel ! []



-- SUBSCRIPTIONS


port replaceModel : (Model -> msg) -> Sub msg


subscriptions : Model -> Sub Msg
subscriptions model =
    replaceModel NewModel



-- VIEW


view : Model -> Html Msg
view model =
    div []
        [ StatusTag.view
            { code = model.statusCode
            , message = model.statusMessage
            , description = model.statusDescription
            }
        , TimeTag.view model.elapsedTime
        , SizeTag.view model.bytesRead
        ]
