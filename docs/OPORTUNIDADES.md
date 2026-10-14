# Oportunidades guardadas para depois

Levantadas em 14/10/2026 com os números da conta principal (542 envios, 13% de resposta de pessoas).

1. **Follow-up quase não roda.** Só 1 follow-up enviado no histórico.
   - Quem recebeu só resposta de robô (131 leads) fica marcado como "respondeu" e é excluído do follow-up.
     Corrigir a elegibilidade no n8n ("Detectar Followups Prontos") para contar só resposta de pessoa.
   - Campanhas anteriores a 14/10 não têm sequência: fazer uma "repescagem" dos leads de 3 a 10 dias,
     sempre passando pela fila de aprovação.
2. **Respostas dadas pelo celular não aparecem no app.** Dos 26 leads quentes, só 8 foram respondidos pela fila.
   O `prospecta-whatsapp` ignora mensagens `fromMe`. Registrar essas mensagens para marcar a fila como
   "respondido no celular", mover o lead no Pipeline e mostrar a conversa completa no Inbox.
3. **Piloto automático.** Volume irregular (dias úteis sem envio). Todo dia útil às 7h o servidor pega o próximo
   item do Plano de Prospecção, busca, separa os melhores e manda no WhatsApp "campanha pronta, responda 1 para enviar".
4. **Aprovar pelo WhatsApp.** O alerta de lead quente traz a sugestão de resposta; "1" envia, "2" abre no app.
5. **Riscos técnicos.**
   - Webhook `receber-resposta` sem segredo compartilhado.
   - Campanha iniciada fora da janela fica esperando dentro de uma execução do n8n (se o n8n reiniciar, para).
   - Chaves do Supabase escritas no código dos nós do n8n (mover para credenciais).
6. **Segunda conta (Igor) sem envios.** Conferir configuração de WhatsApp e IA; um segundo número dobra o volume
   com o mesmo risco por número.
