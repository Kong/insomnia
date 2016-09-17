module StatusTag exposing (..)

import Html exposing (..)
import Html.Attributes exposing (..)


-- MODEL

type alias Model =
    { code : Int
    , message : String
    , description : String
    }

model : Model
model =
    { code = 0
    , message = ""
    , description = ""
    }


-- VIEW

view : Model -> Html a
view model =
    let
        (colorClass, code, message) =
            if (model.code // 100 == 1) then
                ("bg-info", toString model.code, model.message)
            else if (model.code // 100 == 2) then
                ("bg-success", toString model.code, model.message)
            else if (model.code // 100 == 3) then
                ("bg-surprise", toString model.code, model.message)
            else if (model.code // 100 == 4) then
                ("bg-warning", toString model.code, model.message)
            else if (model.code // 100 == 5) then
                ("bg-danger", toString model.code, model.message)
            else if (model.code // 100 == 0) then
                ("bg-danger", "", if model.message /= "" then model.message else "ERROR")
            else if (model.code == -333) then
                ("bg-danger", "", "PEBKAC\xa0\xa0٩◔̯◔۶")
            else
                ("bg-danger", "", "UNKNOWN")
    in
        div [ class <| "tag " ++ colorClass, title model.description ]
            [ strong [ ]
                [ text code
                ]
            , text " "
            , text (if message == "" then "UNKNOWN" else message)
            ]
