// Helper compartilhado do corpo de erro padrão:
// { erro: { codigo, mensagem, campos? } }  ("campos" apenas em 400)
class ErroApp extends Error {
  constructor(status, codigo, mensagem, campos) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

function corpoErro(codigo, mensagem, campos) {
  const erro = { codigo, mensagem };
  if (campos) erro.campos = campos;
  return { erro };
}

function enviarErro(res, status, codigo, mensagem, campos) {
  return res.status(status).json(corpoErro(codigo, mensagem, status === 400 ? campos : undefined));
}

module.exports = { ErroApp, corpoErro, enviarErro };
