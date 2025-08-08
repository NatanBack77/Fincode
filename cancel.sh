#!/bin/bash

# Chave secreta do Stripe (coloque a sua chave aqui)
STRIPE_API_KEY=""

# Função para cancelar assinaturas
cancel_subscriptions() {
  # Inicializa o parâmetro da página
  starting_after=""

  while true; do
    # Listar as assinaturas ativas com paginação
    if [ -z "$starting_after" ]; then
      response=$(curl -s https://api.stripe.com/v1/subscriptions \
        -u "$STRIPE_API_KEY": \
        -G \
        --data-urlencode "status=active" \
        --data-urlencode "limit=100")
    else
      response=$(curl -s https://api.stripe.com/v1/subscriptions \
        -u "$STRIPE_API_KEY": \
        -G \
        --data-urlencode "status=active" \
        --data-urlencode "limit=100" \
        --data-urlencode "starting_after=$starting_after")
    fi


    if echo "$response" | jq . > /dev/null 2>&1; then
      echo "Resposta da API é um JSON válido."
    else
      echo "Erro: a resposta da API não é um JSON válido ou houve um erro na requisição."
      break
    fi

    subscription_ids=$(echo "$response" | jq -r '.data[].id')

    if [ -z "$subscription_ids" ]; then
      echo "Nenhuma assinatura ativa encontrada ou todas já canceladas."
      break
    fi


    for subscription_id in $subscription_ids; do
      echo "Cancelando assinatura: $subscription_id"
      cancel_response=$(curl -s -X DELETE "https://api.stripe.com/v1/subscriptions/$subscription_id" \
        -u "$STRIPE_API_KEY":)

      if echo "$cancel_response" | jq -e '.error' > /dev/null; then
        echo "Erro ao cancelar assinatura $subscription_id: $cancel_response"
      else
        echo "Assinatura $subscription_id cancelada com sucesso."
      fi
    done


    has_more=$(echo "$response" | jq -r '.has_more')
    if [[ "$has_more" == "false" ]]; then
      break
    fi

  
    starting_after=$(echo "$response" | jq -r '.data[-1].id')
  done
}


cancel_subscriptions
