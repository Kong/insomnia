const delimitersData = [
  // Procedence matters
  ["#{", "}"],
  ["{", "}"],
  ["[", "]"]
]

const [startDelimiters, endDelimiters] = delimitersData.reduce(
  (acc, e) => {
    acc[0].push(e[0]);
    acc[1].push(e[1]);
    return acc;
  },
  [[], []] as typeof delimitersData
);

function spacesOnLeft(spaces: number[]) {
  const length = spaces.reduce((acc, e) => acc + e, 0);

  return Array.from({ length })
    .map(() => " ")
    .join("");
}

export const ednPrettify = (edn: string, _filter?: string) => {
  let insideString = false;

  let tokens: string[] = [];

  let symbol = "";

  // let newSymbol = false

  for (const c of edn) {
    if (!insideString) {
      // Ignore when
      if (c === "," || c === "\n" || (c === " ")) {
        if (symbol) {
          tokens.push(symbol)
          symbol = "";
        }
        continue;
      } else if (c === '"') {
        insideString = true;
        symbol += c;
      } else if (c === " " && symbol) {
        tokens.push(symbol);
        symbol = "";
      } else if (startDelimiters.includes(symbol + c)) {
        tokens.push(symbol + c);
        symbol = "";
      } else if (endDelimiters.includes(c)) {
        if (symbol) {
          tokens.push(symbol);
        }
        tokens.push(c);
        symbol = "";
      } else {
        symbol += c;
      }
    } else {
      if (c === '"' && symbol.at(-1) !== "\\") {
        insideString = false;
        tokens.push(symbol + c);
        symbol = "";
      } else if (c === "\n") {
        symbol += "\\n"
      } else {
        symbol += c;
      }
    }
  }

  let lines: string[] = [];

  let currentLine: string[] = [];

  let keyValue: string[] = [];

  let elements: { spaces: number, perLine: number }[] = [];

  let tokenUsed = false;

  for (const [i, t] of tokens.entries()) {
    // If this token already been used, continue for next token
    if (tokenUsed) {
      tokenUsed = false;
      continue;
    }

    // Adds this token to current line
    currentLine.push(t);

    // If its a delimiter, will continue for next token
    const startDelimiter = startDelimiters.includes(t);
    const endDelimiter = endDelimiters.includes(t);

    if (startDelimiter || endDelimiter) {
      if (startDelimiter) {
        const currenLineLength = currentLine.map((e) => e.length).reduce((acc, e) => acc + e)
        const spacesAlreadyCounted = elements.reduce((acc, e) => acc + e.spaces, 0)
        elements.push({ spaces: currenLineLength - spacesAlreadyCounted, perLine: t === "{" ? 2 : 1 });
        keyValue = [];
      }
      continue;
    }

    // Token can be a key, value or metadata, only key and value are valid for line count
    // Metadata are tokens started with # like #uuid
    if (!t.startsWith("#")) {
      keyValue.push(t);
    }

    let endLine = false;

    // If the line already contains a key and value, go to next line
    if (keyValue.length === elements.at(-1)?.perLine) {
      keyValue = [];
      endLine = true;
    }

    const nextToken = tokens.at(i + 1);
    const nextEnding = nextToken && endDelimiters.includes(nextToken);

    // If line is not ending and next token is not a closing delimiter, continue for next token
    if (!endLine && !nextEnding) {
      currentLine.push(" ");
      continue;
    }

    // If the next token is a close delimiter, use this delimiter instead of key/value for end of line
    if (nextEnding) {
      currentLine.push(nextToken);
      tokenUsed = true;
      elements.pop()
    }

    // Create line, add to lines and prepare for next line
    const line = currentLine.join("");
    lines.push(line);
    currentLine = [spacesOnLeft(elements.map(e => e.spaces))];
  }
  // console.log(tokens)

  return lines.join("\n") + currentLine.join("").trim();
};

console.log(ednPrettify(`{:experiment-name :megaexperiment-faster-cashback-nusignals, :ecomm-verticals #{:tablet :notebooks :most_sold :eletronics :cell_phone :smartphone :television :computing :electro :best_blackfriday :childrens_day}, :search {:enabled true}, :experiment-inclusion-groups #{:rollout_awin :control_mega_experiment}, :sort-idx 3, :categories #{:ecommerce}, :terms-and-conditions-url "https://nubank.com.br/termos-de-uso", :kyc-fields #{}, :status :active, :id #uuid "44f3bc25-db7d-45cf-9532-62189cb2ae8d", :help-url "nuapp://nuhelp/", :version 52, :target-url "https://nubank.com.br/samsung-staging", :seller {:id #uuid "5a2cf25e-dcaf-48d8-9e10-82c7669b92de"}, :detail {:description "No site faça login usando seu email e o\n código 101010 e pague com Nubank.", :selling-points-icon-type :number, :partnership-text "Este serviço é uma parceria com a Samsung e o processo continuará em seu site", :name "Samsung", :terms-and-conditions-title "Termos e Condições", :selling-points #{{:name "Selling point 2", :explanation "Para acessar o site faça seu login usando seu email e use o código 101010 (BIN).", :order 1, :icon "nuds_v2_icon.smartphone_lock"} {:name "Selling point 1", :explanation "Pagando com Nubank você pode parcelar o valor em até 24 vezes sem juros.", :order 2, :icon "nuds_v2_icon.smartphone"} {:name "Selling point 3", :explanation "Benefício válido para pagamentos feitos com a opção \\"Pagar com Nubank\\" (NuPay).", :order 3, :icon "nuds_v2_icon.money_in"}}, :base-url "http://parcerias.samsung.com.br/nubank", :benefit "Até 40% de desconto", :handover-description "Este serviço é uma parceria com a Samsung e o processo continuará em seu site", :id #uuid "ab6e1597-696e-4047-8390-f6f77c749ded", :transition-steps #{{:step 2, :text "Aplicando o seu benefício", :action {:sleep-ms 500}} {:step 1, :text "Carregando produtos", :action {:mutation "engagementToken"}} {:step 3, :text "Indo para\nLoja", :action {:sleep-ms 500}}}, :query-params #{{:name "utm_source", :value "nubank-samsung"} {:name "utm_campaign", :value "nubank-samsung"}}, :engagement-token {:query-param-name "token"}, :terms-and-conditions-text "As ofertas apresentadas nesta página são oferecidas por nossos parceiros. Ao continuar você reconhece que esses parceiros são responsáveis por suas ofertas e pelo atendimento referente a elas. Você pode entrar em contato com a gente a qualquer momento para entender mais sobre nossas parcerias.", :handover-title "Indo para Samsung", :handover-action-text "Continuar para loja", :action-text "action text detail", :handover-enabled? false}}`));

// console.log(ednPrettify(`{:name "Benefício válido para pagamentos feitos com a opção \\"Pagar com Nubank\\" (NuPay)."}`))

// console.log(ednPrettify('{:name "ga\nrug"}'))

// console.log(
//   ednPrettify(
//     `{:name #uuid "garug" :age 20 :enabled true :likes #{"dogs" "cats"}}`
//   )
// );

// console.log(ednPrettify(`{:prop1 {:prop2 {:prop3 :b}}}`));
