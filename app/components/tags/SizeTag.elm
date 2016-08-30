module SizeTag exposing (..)

import Html exposing (..)
import Html.Attributes exposing (..)


-- MODEL


type alias Model =
    Int


model : number
model =
    0



-- VIEW


view : Model -> Html a
view bytes =
    let
        ( size, unit ) =
            if bytes < 1024 then
                ( bytes, "B" )
            else if bytes < 1024 * 1024 then
                ( bytes / 1024, "KB" )
            else if bytes < 1024 * 1024 * 1024 then
                ( bytes / 1024 / 1024, "MB" )
            else
                ( bytes / 1024 / 1024 / 1024, "GB" )
    in
        div [ class "tag" ]
            [ strong [] [ text "SIZE " ]
            , text (toString (toFloat (round (size * 10)) / 10))
            , text " "
            , text unit
            ]
