import { saveFlowAction } from '@/app/actions';
import { AdminShell } from '@/components/admin-shell';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function FlowDiagramPage() {
  await requireAuth();

  const flows = await prisma.flow.findMany({
    include: {
      context: true,
      intents: {
        include: {
          routeRule: true
        },
        orderBy: { priority: 'asc' }
      },
    },
    orderBy: { name: 'asc' },
  });

  // Couleurs pour différents types de flows
  const flowColors = {
    principal: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }, // Bleu
    technique: { bg: '#dcfce7', border: '#22c55e', text: '#166534' }, // Vert
    ventes: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' }, // Orange
    support: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' }, // Rose
    default: { bg: '#f3f4f6', border: '#9ca3af', text: '#4b5563' }, // Gris
  };

  const getFlowColor = (flowName: string) => {
    const name = flowName.toLowerCase();
    if (name.includes('principal')) return flowColors.principal;
    if (name.includes('technique') || name.includes('support')) return flowColors.technique;
    if (name.includes('vente') || name.includes('commercial')) return flowColors.ventes;
    if (name.includes('support')) return flowColors.support;
    return flowColors.default;
  };

  return (
    <AdminShell
      title="Diagramme des Flows"
      subtitle="Visualisez les parcours d’appel et leurs transitions"
    >
      <div style={{ padding: '2rem' }}>
        {/* En-tête */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
            Workflow des Appels
          </h1>
          <p style={{ color: '#6B7280', marginTop: '0.5rem' }}>
            {flows.length} flows interconnectés • Cliquez sur une tuile pour voir les détails
          </p>
        </div>

        {/* Grille de flows */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
          gap: '1.5rem',
          position: 'relative'
        }}>
          {flows.map((flow, index) => {
            const colors = getFlowColor(flow.name);
            const welcomePreview = flow.welcomeMessage 
              ? (flow.welcomeMessage.length > 60 
                  ? flow.welcomeMessage.substring(0, 60) + '...' 
                  : flow.welcomeMessage)
              : 'Pas de message d\'accueil';

            return (
              <div 
                key={flow.id}
                style={{
                  backgroundColor: colors.bg,
                  border: `2px solid ${colors.border}`,
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  position: 'relative',
                  minHeight: '220px'
                }}
              >
                {/* En-tête de la tuile */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: flow.isActive ? '#10b981' : '#9ca3af'
                    }}></div>
                    <h3 style={{ 
                      fontWeight: 'bold', 
                      fontSize: '1.25rem',
                      color: colors.text
                    }}>
                      {flow.name}
                    </h3>
                  </div>
                  
                  {/* Description du flow */}
                  <div style={{ 
                    backgroundColor: 'rgba(255,255,255,0.7)', 
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    marginBottom: '1rem',
                    border: '1px solid rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.25rem' }}>
                      <strong>Accueil:</strong>
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#1f2937' }}>
                      <span>&quot;{welcomePreview}&quot;</span>
                    </div>
                  </div>
                </div>

                {/* Intentions/options */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '500', color: colors.text, marginBottom: '0.5rem' }}>
                    Options disponibles:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {flow.intents.slice(0, 3).map((intent, idx) => (
                      <div 
                        key={intent.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: 'white',
                          borderRadius: '0.375rem',
                          border: '1px solid #e5e7eb'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ 
                            width: '20px', 
                            height: '20px', 
                            borderRadius: '50%', 
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem'
                          }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontSize: '0.875rem' }}>{intent.label}</span>
                        </div>
                        <div style={{ 
                          fontSize: '0.75rem', 
                          backgroundColor: '#f3f4f6',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          color: '#6B7280'
                        }}>
                          → poste {intent.destinationPost || '--'}
                        </div>
                      </div>
                    ))}
                    
                    {flow.intents.length > 3 && (
                      <div style={{ 
                        fontSize: '0.875rem', 
                        color: '#6B7280',
                        textAlign: 'center',
                        padding: '0.5rem'
                      }}>
                        + {flow.intents.length - 3} autres options
                      </div>
                    )}
                  </div>
                </div>

                {/* Statut et actions */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid rgba(0,0,0,0.1)',
                  paddingTop: '1rem'
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span style={{ 
                      fontSize: '0.75rem',
                      backgroundColor: flow.isActive ? '#10b981' : '#9ca3af',
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem'
                    }}>
                      {flow.isActive ? 'ACTIF' : 'INACTIF'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                      {flow.intents.length} options
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{ 
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem'
                    }}>
                      Ouvrir
                    </button>
                  </div>
                </div>

                {/* Indicateur de connexion (pour le diagramme) */}
                {index < flows.length - 1 && (
                  <div style={{
                    position: 'absolute',
                    right: '-1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '2rem',
                    height: '2px',
                    backgroundColor: '#9ca3af'
                  }}>
                    <div style={{
                      position: 'absolute',
                      right: '-4px',
                      top: '-3px',
                      width: '0',
                      height: '0',
                      borderTop: '4px solid transparent',
                      borderBottom: '4px solid transparent',
                      borderLeft: '6px solid #9ca3af'
                    }}></div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Tuile "Ajouter un flow" */}
          <form action={saveFlowAction}>
            <button 
              type="submit"
              style={{
                width: '100%',
                height: '100%',
                minHeight: '220px',
                border: '2px dashed #d1d5db',
                borderRadius: '0.75rem',
                padding: '2rem',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem'
              }}
            >
              <div style={{
                width: '4rem',
                height: '4rem',
                backgroundColor: '#dbeafe',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '2rem', color: '#2563eb' }}>+</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.125rem', fontWeight: '500', color: '#374151' }}>
                  Ajouter un Flow
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.25rem' }}>
                  Créer un nouveau parcours d’appel
                </div>
              </div>
            </button>
          </form>
        </div>

        {/* Légende */}
        <div style={{
          marginTop: '3rem',
          padding: '1.5rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
            Légende du diagramme
          </h3>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '4px' }}></div>
              <span style={{ fontSize: '0.875rem' }}>Flow principal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: '#dcfce7', border: '2px solid #22c55e', borderRadius: '4px' }}></div>
              <span style={{ fontSize: '0.875rem' }}>Support technique</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '4px' }}></div>
              <span style={{ fontSize: '0.875rem' }}>Ventes/Commercial</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
              <span style={{ fontSize: '0.875rem' }}>Actif</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#9ca3af' }}></div>
              <span style={{ fontSize: '0.875rem' }}>Inactif</span>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}