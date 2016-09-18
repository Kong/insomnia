port module UrlBar exposing (..)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (..)
import Html.App as App
import Base.Dropdown as Dropdown


-- APP


main : Program DataModel
main =
    App.programWithFlags
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }



-- MODEL


type alias Model =
    { data : DataModel
    , dropdown : Dropdown.Model
    }


type alias DataModel =
    { url : String
    , method : String
    }


init : DataModel -> ( Model, Cmd Msg )
init flags =
    let
        dropdownDefaults =
            Dropdown.init

        button =
            { text = flags.method
            , class = ""
            }

        buildItem method =
            { text = method
            , icon = Nothing
            , value = method
            , class = "method-" ++ method
            }

        items =
            List.map buildItem getMethods

        dropdown =
            { dropdownDefaults | button = button, items = items }
    in
        { dropdown = dropdown, data = flags } ! []



-- UPDATE


type Msg
    = SendRequest
    | NewData DataModel
    | DataMessage DataMsg
    | DropdownMessage Dropdown.Msg


type DataMsg
    = NewMethod String
    | NewUrl String


port onSendRequest : Bool -> Cmd msg


port onUrlChange : String -> Cmd msg


port onMethodChange : String -> Cmd msg


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        DataMessage msg ->
            let
                ( data, cmd ) =
                    updateData msg model.data
            in
                { model | data = data } ! [ cmd ]

        NewData data ->
            let
                dropdown =
                    Dropdown.updateButtonText model.dropdown data.method

                -- Keep Url the same so we don't overwrite typing
                dataWithOldUrl =
                    { data | url = model.data.url }
            in
                { model | data = dataWithOldUrl, dropdown = dropdown } ! []

        SendRequest ->
            model ! [ onSendRequest True ]

        DropdownMessage dropdownMsg ->
            let
                ( dropdownModel, dropdownAction ) =
                    Dropdown.update dropdownMsg model.dropdown

                cmd =
                    case dropdownAction of
                        Dropdown.OnClick method ->
                            onMethodChange method

                        Dropdown.NoOp ->
                            Cmd.none
            in
                { model | dropdown = dropdownModel } ! [ cmd ]


updateData : DataMsg -> DataModel -> ( DataModel, Cmd Msg )
updateData msg model =
    case msg of
        NewUrl url ->
            { model | url = url } ! [ onUrlChange url ]

        NewMethod method ->
            { model | method = method } ! [ onMethodChange method ]



-- SUBSCRIPTIONS


port replaceModel : (DataModel -> msg) -> Sub msg


subscriptions : Model -> Sub Msg
subscriptions model =
    replaceModel NewData



-- VIEW


view : Model -> Html Msg
view model =
    let
        method =
            model.data.method

        url =
            model.data.url
    in
        div [ class "urlbar" ]
            [ App.map DropdownMessage <| Dropdown.view model.dropdown
            , Html.form [ onSubmit SendRequest ]
                [ div [ class "form-control" ]
                    [ App.map DataMessage <|
                        input
                            [ type' "text"
                            , value url
                            , onInput NewUrl
                            , placeholder "https://api.myproduct.com/v1/users"
                            ]
                            []
                    ]
                , button [ type' "submit" ] [ text "Send" ]
                ]
            ]



-- UTIL


getMethods =
    [ "GET"
    , "POST"
    , "PUT"
    , "PATCH"
    , "DELETE"
    , "OPTIONS"
    , "HEAD"
    ]
