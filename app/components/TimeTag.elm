module TimeTag exposing (..)

import Html exposing (..)
import Html.Attributes exposing (..)


-- MODEL

type alias Model = Int

model : number
model = 0


-- VIEW

view : Model -> Html a
view milliseconds =
    let
        (unit, number) =
            if milliseconds > (1000 * 60)
                then ("m", milliseconds / 1000 / 60)
            else if milliseconds > 1000
                then ("s", milliseconds / 1000)
            else
                ("ms", milliseconds)
    in
        div [ class "tag" ]
            [ strong [ ] [ text "TIME " ]
            , text (toString (toFloat (round (number * 10)) / 10))
            , text " "
            , text unit
            ]
